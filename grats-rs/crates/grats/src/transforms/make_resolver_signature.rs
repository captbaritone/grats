use graphql_js::language::ast::{
    DefinitionNode, DocumentNode, ResolverArgument as DirectiveResolverArgument, ResolverSignature,
};

use crate::metadata::{FieldDefinition, Metadata, ResolverArgument, ResolverDefinition};

/// How each field of each object type is resolved.
pub fn make_resolver_signature(document_ast: &DocumentNode) -> Metadata {
    let types = document_ast
        .definitions
        .iter()
        .filter_map(|declaration| match declaration {
            DefinitionNode::ObjectTypeDefinition(declaration) => Some(declaration),
            _ => None,
        })
        .filter_map(|declaration| {
            let fields = declaration.fields.as_ref()?;
            let field_resolvers = fields
                .iter()
                .map(|field_ast| {
                    let signature = field_ast
                        .resolver
                        .as_ref()
                        .expect("Expected field to have a resolver");
                    let resolver = resolver_definition(signature);
                    (field_ast.name.value.clone(), FieldDefinition { resolver })
                })
                .collect();
            Some((declaration.name.value.clone(), field_resolvers))
        })
        .collect();
    Metadata { types }
}

fn resolver_definition(signature: &ResolverSignature) -> ResolverDefinition {
    match signature {
        ResolverSignature::Property { name } => ResolverDefinition::Property { name: name.clone() },
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
    }
}

fn transform_args(args: Option<&[DirectiveResolverArgument]>) -> Option<Vec<ResolverArgument>> {
    args.map(|args| args.iter().map(transform_arg).collect())
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
