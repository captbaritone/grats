use graphql_js::r#type::definition::{GraphQLEnumType, GraphQLNamedType};
use graphql_js::r#type::schema::GraphQLSchema;
use oxc_allocator::{Allocator, ArenaVec};
use oxc_ast::ast::*;
use oxc_span::SPAN;

use crate::codegen::ts_ast_builder::TsAstBuilder;
use crate::grats_config::GratsConfig;

/// Given a GraphQL schema, returns TypeScript code that exports all enums
/// as a single object mapping enum names to their TypeScript values.
pub fn codegen_enums(
    schema: &GraphQLSchema,
    config: &GratsConfig,
    destination: &str,
    grats_root: &str,
) -> String {
    let allocator = Allocator::default();
    let mut ts = TsAstBuilder::new(
        &allocator,
        destination,
        &config.import_module_specifier_ending,
        grats_root,
    );
    // Collect all user-defined enum types (filter out built-in/introspection enums)
    let enum_types: Vec<&GraphQLEnumType> = schema
        .get_type_map()
        .values()
        .filter_map(|&r#type| match &schema[r#type] {
            // Filter out introspection types
            GraphQLNamedType::Enum(r#type) if !r#type.name.starts_with("__") => Some(r#type),
            _ => None,
        })
        .collect();

    for enum_type in &enum_types {
        import_enum(&mut ts, enum_type);
    }

    let enums_object = enums_object(&ts, &enum_types);
    ts.add_statement(enums_object);

    // Also export individual enums for convenience
    for enum_type in &enum_types {
        let export = enum_export(&ts, enum_type);
        ts.add_statement(export);
    }

    ts.print()
}

/// The name each enum is imported as.
fn local_name(enum_type: &GraphQLEnumType) -> String {
    format!("{}Enum", enum_type.name)
}

fn import_enum(ts: &mut TsAstBuilder, enum_type: &GraphQLEnumType) {
    // Assert that astNode and exported info are present - this should be guaranteed by validation
    let exported = enum_type
        .ast_node
        .and_then(|ast| ast.exported.as_ref())
        .expect("Expected enum to be exported");
    ts.import_user_construct(
        &exported.ts_module_path,
        exported.export_name.as_deref(),
        &local_name(enum_type),
        false,
    );
}

/// `export const enums = { Name: NameEnum, ... };`
fn enums_object<'a>(ts: &TsAstBuilder<'a>, enum_types: &[&GraphQLEnumType]) -> Statement<'a> {
    let enum_properties = ArenaVec::from_iter_in(
        enum_types.iter().map(|enum_type| {
            ObjectPropertyKind::new_object_property(
                SPAN,
                PropertyKind::Init,
                PropertyKey::new_static_identifier(
                    SPAN,
                    Ident::from_str_in(enum_type.name, ts),
                    ts,
                ),
                Expression::new_identifier(
                    SPAN,
                    Ident::from_str_in(&local_name(enum_type), ts),
                    ts,
                ),
                false,
                false,
                false,
                ts,
            )
        }),
        ts,
    );
    Statement::new_export_declaration(
        SPAN,
        Declaration::new_variable_declaration(
            SPAN,
            VariableDeclarationKind::Const,
            ArenaVec::from_array_in(
                [VariableDeclarator::new(
                    SPAN,
                    BindingPattern::new_binding_identifier(SPAN, "enums", ts),
                    None,
                    Some(Expression::new_object_expression(SPAN, enum_properties, ts)),
                    false,
                    ts,
                )],
                ts,
            ),
            false,
            ts,
        ),
        ts,
    )
}

/// `export { NameEnum as Name };`
fn enum_export<'a>(ts: &TsAstBuilder<'a>, enum_type: &GraphQLEnumType) -> Statement<'a> {
    Statement::new_export_named_declaration(
        SPAN,
        ArenaVec::from_array_in(
            [ExportSpecifier::new(
                SPAN,
                ModuleExportName::new_identifier_reference(
                    SPAN,
                    Ident::from_str_in(&local_name(enum_type), ts),
                    ts,
                ),
                ModuleExportName::new_identifier_name(
                    SPAN,
                    Ident::from_str_in(enum_type.name, ts),
                    ts,
                ),
                ImportOrExportKind::Value,
                ts,
            )],
            ts,
        ),
        ImportOrExportKind::Value,
        ts,
    )
}

#[cfg(test)]
mod tests {
    use graphql_js::language::ast::DocumentNode;

    use crate::grats_config::validate_grats_options;
    use graphql_js::utilities::build_ast_schema::build_ast_schema;
    use serde_json::{Value, json};

    use super::*;

    fn enum_definition(name: &str, exported: Value) -> Value {
        json!({
            "kind": "EnumTypeDefinition",
            "name": { "value": name },
            "values": [{ "name": { "value": "A" } }],
            "exported": exported,
        })
    }

    fn codegen(definitions: Vec<Value>, destination: &str) -> String {
        let doc: DocumentNode =
            serde_json::from_value(json!({ "definitions": definitions })).unwrap();
        let schema = build_ast_schema(&doc);
        let config: GratsConfig = validate_grats_options(Some(&json!({
            "tsClientEnumsHeader": null,
            "importModuleSpecifierEnding": ".js",
        })))
        .unwrap()
        .config;
        codegen_enums(&schema, &config, destination, "/root/grats")
    }

    #[test]
    fn imports_and_exports_each_enum() {
        let code = codegen(
            vec![
                enum_definition(
                    "Color",
                    json!({ "tsModulePath": "../project/src/index.ts", "exportName": "Color" }),
                ),
                enum_definition(
                    "Priority",
                    json!({ "tsModulePath": "../project/src/index.ts", "exportName": "Priority" }),
                ),
                enum_definition(
                    "Size",
                    json!({ "tsModulePath": "../project/src/size.ts", "exportName": null }),
                ),
            ],
            "/root/project/enums.ts",
        );
        assert_eq!(
            code,
            r#"import SizeEnum from "./src/size.js";
import { Color as ColorEnum, Priority as PriorityEnum } from "./src/index.js";
export const enums = {
    Color: ColorEnum,
    Priority: PriorityEnum,
    Size: SizeEnum
};
export { ColorEnum as Color };
export { PriorityEnum as Priority };
export { SizeEnum as Size };
"#
        );
    }

    #[test]
    fn skips_introspection_enums() {
        let code = codegen(vec![], "/root/project/enums.ts");
        assert_eq!(code, "export const enums = {};\n");
    }
}
