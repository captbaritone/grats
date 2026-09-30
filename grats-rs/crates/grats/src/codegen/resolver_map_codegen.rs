//! Port of `src/codegen/resolverMapCodegen.ts`.

use graphql_js::r#type::definition::GraphQLNamedType;
use graphql_js::r#type::schema::GraphQLSchema;
use indexmap::IndexMap;
use oxc_allocator::Allocator;
use oxc_ast::ast::*;

use crate::codegen::resolver_codegen::ResolverCodegen;
use crate::codegen::ts_ast_builder::{ImportSpecifier, TsAstBuilder};
use crate::grats_config::GratsConfig;
use crate::metadata::{FieldDefinition, Metadata};
use crate::utils::helpers::null_throws;

/// EXPERIMENTAL!
///
/// Codegen for a GraphQL Tools style resolver map. This is an alternative to
/// generating a GraphQLSchema directly. This is mostly provided as an example
/// and the goal is that eventually it should be possible to generate this output
/// in userland.
///
/// https://the-guild.dev/graphql/tools/docs/resolvers#resolver-map
///
/// PORT: Also takes the root that module paths are relative to. See
/// `src/grats_root.rs`.
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
    /// `_resolvers` in the TypeScript implementation.
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
        let mut types = Vec::new();
        for (type_name, fields) in &self.metadata.types {
            let resolver_methods = self.resolvers_methods(type_name, fields);
            if !resolver_methods.is_empty() {
                types.push(Some(self.ts.property_assignment(
                    type_name,
                    self.ts.object_literal(resolver_methods),
                )));
            }
        }
        types
    }

    fn resolvers_methods(
        &mut self,
        type_name: &str,
        field_definitions: &'s IndexMap<String, FieldDefinition>,
    ) -> Vec<Option<ObjectPropertyKind<'a>>> {
        let schema = self.schema;
        let graphql_type = match schema.get_type(type_name).map(|id| &schema[id]) {
            Some(GraphQLNamedType::Object(graphql_type)) => graphql_type,
            _ => panic!("Type {type_name} is not an object type"),
        };
        let mut fields = Vec::new();
        for field_name in field_definitions.keys() {
            let method = self.resolvers.resolve_method(
                &mut self.ts,
                field_name,
                field_name,
                type_name,
                null_throws(graphql_type.ast_node).exported.as_ref(),
            );
            let wrapped = self.resolvers.maybe_apply_semantic_null_runtime_check(
                &mut self.ts,
                &graphql_type.get_fields()[field_name.as_str()],
                method,
                field_name,
            );
            if wrapped.is_some() {
                fields.push(wrapped);
            }
        }

        fields
    }
}
