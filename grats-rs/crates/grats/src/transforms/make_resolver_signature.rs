//! Port of `src/transforms/makeResolverSignature.ts`.

use graphql_js::language::ast::{
    DefinitionNode, DocumentNode, ResolverArgument as DirectiveResolverArgument, ResolverSignature,
};
use indexmap::IndexMap;

use crate::metadata::{FieldDefinition, Metadata, ResolverArgument, ResolverDefinition};
use crate::utils::helpers::null_throws;

pub fn make_resolver_signature(document_ast: &DocumentNode) -> Metadata {
    let mut resolvers = Metadata {
        types: IndexMap::new(),
    };

    for declaration in &document_ast.definitions {
        let DefinitionNode::ObjectTypeDefinition(declaration) = declaration else {
            continue;
        };
        let Some(fields) = &declaration.fields else {
            continue;
        };

        let mut field_resolvers: IndexMap<String, FieldDefinition> = IndexMap::new();

        for field_ast in fields {
            let field_resolver = null_throws(field_ast.resolver.as_ref());
            let field_name = &field_ast.name.value;
            let resolver = match field_resolver {
                ResolverSignature::Property { name } => {
                    ResolverDefinition::Property { name: name.clone() }
                }
                ResolverSignature::Function {
                    path,
                    export_name,
                    arguments,
                } => ResolverDefinition::Function {
                    path: path.clone(),
                    export_name: export_name.clone(),
                    arguments: transform_args(arguments.as_deref()),
                },
                ResolverSignature::Method { name, arguments } => ResolverDefinition::Method {
                    name: name.clone(),
                    arguments: transform_args(arguments.as_deref()),
                },
                ResolverSignature::StaticMethod {
                    path,
                    export_name,
                    name,
                    arguments,
                } => ResolverDefinition::StaticMethod {
                    path: path.clone(),
                    export_name: export_name.clone(),
                    name: name.clone(),
                    arguments: transform_args(arguments.as_deref()),
                },
            };

            field_resolvers.insert(field_name.clone(), FieldDefinition { resolver });
        }

        resolvers
            .types
            .insert(declaration.name.value.clone(), field_resolvers);
    }

    resolvers
}

fn transform_args(args: Option<&[DirectiveResolverArgument]>) -> Option<Vec<ResolverArgument>> {
    let args = args?;
    Some(args.iter().map(transform_arg).collect())
}

fn transform_arg(arg: &DirectiveResolverArgument) -> ResolverArgument {
    match arg {
        DirectiveResolverArgument::ArgumentsObject { .. } => ResolverArgument::ArgumentsObject,
        DirectiveResolverArgument::Named { name, .. } => ResolverArgument::Named { name: name.clone() },
        DirectiveResolverArgument::Source { .. } => ResolverArgument::Source,
        DirectiveResolverArgument::Information { .. } => ResolverArgument::Information,
        DirectiveResolverArgument::Context { .. } => ResolverArgument::Context,
        DirectiveResolverArgument::DerivedContext {
            path,
            export_name,
            r#async,
            args,
            ..
        } => ResolverArgument::DerivedContext {
            path: path.clone(),
            export_name: export_name.clone(),
            r#async: *r#async,
            args: args
                .iter()
                .map(|arg| {
                    let new_arg = transform_arg(arg);
                    assert!(
                        matches!(
                            new_arg,
                            ResolverArgument::DerivedContext { .. } | ResolverArgument::Context
                        ),
                        "Previous validation passes ensure we only have valid derived context args here",
                    );
                    new_arg
                })
                .collect(),
        },
        DirectiveResolverArgument::Unresolved { .. } => panic!("Unresolved argument in resolver"),
    }
}
