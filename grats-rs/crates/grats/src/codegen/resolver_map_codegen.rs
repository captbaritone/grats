use graphql_js::r#type::definition::GraphQLNamedType;
use graphql_js::r#type::schema::GraphQLSchema;
use indexmap::IndexMap;
use oxc_allocator::Allocator;
use oxc_ast::ast::*;

use crate::codegen::resolver_codegen::ResolverCodegen;
use crate::codegen::ts_ast_builder::{ImportSpecifier, TsAstBuilder};
use crate::grats_config::GratsConfig;
use crate::metadata::{FieldDefinition, Metadata};

/// EXPERIMENTAL!
///
/// Codegen for a GraphQL Tools style resolver map. This is an alternative to
/// generating a GraphQLSchema directly. This is mostly provided as an example
/// and the goal is that eventually it should be possible to generate this output
/// in userland.
///
/// https://the-guild.dev/graphql/tools/docs/resolvers#resolver-map
///
/// Module paths are relative to `grats_root`. See `src/grats_root.rs`.
pub fn resolver_map_codegen(
    schema: &GraphQLSchema,
    resolvers: &Metadata,
    config: &GratsConfig,
    destination: &str,
    grats_root: &str,
) -> String {
    let allocator = Allocator::default();
    let mut codegen = Codegen {
        ts: TsAstBuilder::new(
            &allocator,
            destination,
            &config.import_module_specifier_ending,
            grats_root,
        ),
        resolvers: ResolverCodegen::new(resolvers),
        schema,
        metadata: resolvers,
    };

    codegen.resolver_map_export();

    codegen.ts.print()
}

struct Codegen<'s, 'd, 'a> {
    ts: TsAstBuilder<'a>,
    resolvers: ResolverCodegen<'s>,
    schema: &'s GraphQLSchema<'d>,
    metadata: &'s Metadata,
}

impl<'a> AsMut<TsAstBuilder<'a>> for Codegen<'_, '_, 'a> {
    fn as_mut(&mut self) -> &mut TsAstBuilder<'a> {
        &mut self.ts
    }
}

impl<'s, 'a> Codegen<'s, '_, 'a> {
    fn resolver_map_export(&mut self) {
        // I'm not crazy about this. One of Grats' design goals is to be as tightly
        // coupled to just TypeScript and GraphQL JS. Ideally we would not do
        // _anything_ coupled to other libraries but instead provide a way for users
        // to do this themselves.
        self.ts.import(
            "@graphql-tools/utils",
            vec![ImportSpecifier {
                name: "IResolvers".to_string(),
                r#as: None,
                is_type_only: true,
            }],
        );
        let return_type = self.ts.type_reference("IResolvers", vec![]);
        let body = TsAstBuilder::create_block_with_scope(self, |this| {
            let resolver_map = this.resolver_map();
            let statement = this.ts.return_statement(resolver_map);
            this.ts.add_statement(statement);
        });
        self.ts
            .function_declaration("getResolverMap", true, vec![], Some(return_type), body);
    }

    fn resolver_map(&mut self) -> Expression<'a> {
        let types = self.types();
        self.ts.object_literal(types)
    }

    fn types(&mut self) -> Vec<Option<ObjectPropertyKind<'a>>> {
        let metadata = self.metadata;
        metadata
            .types
            .iter()
            .filter_map(|(type_name, fields)| {
                let resolver_methods = self.resolvers_methods(type_name, fields);
                if resolver_methods.is_empty() {
                    return None;
                }
                let methods = self.ts.object_literal(resolver_methods);
                Some(self.ts.property_assignment(type_name, methods))
            })
            .map(Some)
            .collect()
    }

    fn resolvers_methods(
        &mut self,
        type_name: &str,
        field_definitions: &'s IndexMap<String, FieldDefinition>,
    ) -> Vec<Option<ObjectPropertyKind<'a>>> {
        let schema = self.schema;
        let Some(GraphQLNamedType::Object(graphql_type)) =
            schema.get_type(type_name).map(|id| &schema[id])
        else {
            panic!("Type {type_name} is not an object type");
        };
        let exported = graphql_type
            .ast_node
            .expect("Expected object type to have astNode")
            .exported
            .as_ref();
        field_definitions
            .keys()
            .map(|field_name| {
                let method = self.resolvers.resolve_method(
                    &mut self.ts,
                    field_name,
                    field_name,
                    type_name,
                    exported,
                );
                self.resolvers.maybe_apply_semantic_null_runtime_check(
                    &mut self.ts,
                    &graphql_type.get_fields()[field_name.as_str()],
                    method,
                    field_name,
                )
            })
            .filter(Option::is_some)
            .collect()
    }
}
