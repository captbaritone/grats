//! Port of `src/codegen/enumCodegen.ts`.

use std::collections::HashMap;

use graphql_js::r#type::definition::{GraphQLEnumType, GraphQLNamedType};
use graphql_js::r#type::schema::GraphQLSchema;
use oxc_allocator::{Allocator, ArenaVec};
use oxc_ast::ast::*;
use oxc_span::SPAN;

use crate::codegen::ts_ast_builder::TsAstBuilder;
use crate::grats_config::GratsConfig;
use crate::utils::helpers::null_throws;

// Given a GraphQL schema, returns TypeScript code that exports all enums
// as a single object mapping enum names to their TypeScript values.
pub fn codegen_enums(
    schema: &GraphQLSchema,
    config: &GratsConfig,
    destination: &str,
    grats_root: &str,
) -> String {
    let allocator = Allocator::default();
    let codegen = EnumCodegen::new(schema, config, destination, grats_root, &allocator);
    codegen.generate()
}

struct EnumCodegen<'s, 'd, 'a> {
    ts: TsAstBuilder<'a>,
    /// PORT: Maps each enum's name to its local name. The TypeScript
    /// implementation also stores the module path and export name, which are
    /// never read.
    enum_imports: HashMap<&'s str, String>,
    schema: &'s GraphQLSchema<'d>,
}

impl<'s, 'd, 'a> EnumCodegen<'s, 'd, 'a> {
    fn new(
        schema: &'s GraphQLSchema<'d>,
        config: &GratsConfig,
        destination: &str,
        grats_root: &str,
        allocator: &'a Allocator,
    ) -> Self {
        EnumCodegen {
            ts: TsAstBuilder::new(
                allocator,
                destination,
                &config.import_module_specifier_ending,
                grats_root,
            ),
            enum_imports: HashMap::new(),
            schema,
        }
    }

    fn generate(mut self) -> String {
        let schema = self.schema;
        // Collect all user-defined enum types (filter out built-in/introspection enums)
        let enum_types: Vec<&'s GraphQLEnumType<'d>> = schema
            .get_type_map()
            .values()
            .filter_map(|&r#type| match &schema[r#type] {
                // Filter out introspection types
                GraphQLNamedType::Enum(r#type) if !r#type.name.starts_with("__") => Some(r#type),
                _ => None,
            })
            .collect();

        // Collect enum export information and import statements
        for enum_type in &enum_types {
            self.collect_enum_exports(enum_type);
        }

        // Generate the enums export object
        self.generate_enums_object(&enum_types);

        self.ts.print()
    }

    fn collect_enum_exports(&mut self, enum_type: &'s GraphQLEnumType<'d>) {
        // Assert that astNode and exported info are present - this should be guaranteed by validation
        let ast_node = null_throws(enum_type.ast_node);
        let exported = null_throws(ast_node.exported.as_ref());

        let local_name = format!("{}Enum", enum_type.name);
        self.enum_imports.insert(enum_type.name, local_name.clone());

        // Import the enum
        self.ts.import_user_construct(
            &exported.ts_module_path,
            exported.export_name.as_deref(),
            &local_name,
            false,
        );
    }

    fn generate_enums_object(&mut self, enum_types: &[&'s GraphQLEnumType<'d>]) {
        let ts = &self.ts;
        // All enums should have import information at this point
        let enum_properties = ArenaVec::from_iter_in(
            enum_types.iter().map(|enum_type| {
                let local_name = null_throws(self.enum_imports.get(enum_type.name));
                ObjectPropertyKind::new_object_property(
                    SPAN,
                    PropertyKind::Init,
                    PropertyKey::new_static_identifier(
                        SPAN,
                        Ident::from_str_in(enum_type.name, ts),
                        ts,
                    ),
                    Expression::new_identifier(SPAN, Ident::from_str_in(local_name, ts), ts),
                    false,
                    false,
                    false,
                    ts,
                )
            }),
            ts,
        );

        // Create the exported enums object
        let enums_object = Statement::new_export_declaration(
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
        );
        self.ts.add_statement(enums_object);

        // Also export individual enums for convenience
        for enum_type in enum_types {
            let ts = &self.ts;
            let local_name = null_throws(self.enum_imports.get(enum_type.name));
            let export = Statement::new_export_named_declaration(
                SPAN,
                ArenaVec::from_array_in(
                    [ExportSpecifier::new(
                        SPAN,
                        ModuleExportName::new_identifier_reference(
                            SPAN,
                            Ident::from_str_in(local_name, ts),
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
            );
            self.ts.add_statement(export);
        }
    }
}

#[cfg(test)]
mod tests {
    use graphql_js::language::ast::DocumentNode;
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
        let config: GratsConfig = serde_json::from_value(json!({
            "schemaHeader": null,
            "tsClientEnumsHeader": null,
            "importModuleSpecifierEnding": ".js",
            "strictSemanticNullability": false,
        }))
        .unwrap();
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
