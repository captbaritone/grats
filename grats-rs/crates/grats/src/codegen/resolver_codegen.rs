//! Port of `src/codegen/resolverCodegen.ts`.

use std::collections::{HashMap, HashSet};

use graphql_js::language::ast::{ConstDirectiveNode, ExportDefinition};
use graphql_js::r#type::definition::GraphQLField;
use oxc_ast::ast::*;
use oxc_span::SPAN;

use crate::codegen::ts_ast_builder::{ImportSpecifier, TsAstBuilder};
use crate::codegen_helpers::{ASSERT_NON_NULL_HELPER, create_assert_non_null_helper};
use crate::metadata::{Metadata, ResolverArgument, ResolverDefinition};
use crate::public_directives::SEMANTIC_NON_NULL_DIRECTIVE;
use crate::utils::helpers::null_throws;

const RESOLVER_ARGS: [&str; 4] = ["source", "args", "context", "info"];

const TYPE_RESOLVER_ARGS: bool = false;

/// Codegen specifically for generating resolver methods for a given field.
/// Having this separate from the other codegen classes allows it to be used
/// for any codegen that needs to generate resolver methods.
///
/// PORT: The TypeScript implementation holds the `TSAstBuilder` it shares with
/// the codegen using it. Here each method takes the builder instead.
pub struct ResolverCodegen<'m> {
    helpers: HashSet<&'static str>,
    derived_context_names: HashMap<String, String>,
    resolvers: &'m Metadata,
}

impl<'m> ResolverCodegen<'m> {
    pub fn new(resolvers: &'m Metadata) -> Self {
        ResolverCodegen {
            helpers: HashSet::new(),
            derived_context_names: HashMap::new(),
            resolvers,
        }
    }

    pub fn resolve_method<'a>(
        &mut self,
        ts: &mut TsAstBuilder<'a>,
        field_name: &str,
        method_name: &str,
        parent_type_name: &str,
        source_export: Option<&ExportDefinition>,
    ) -> Option<ObjectPropertyKind<'a>> {
        let resolver = &self.resolvers.types[parent_type_name][field_name].resolver;
        if self.is_default_resolver_signature(field_name, resolver) {
            return None;
        }

        let get_source_type_ref = |ts: &mut TsAstBuilder<'a>| -> Option<TSType<'a>> {
            let source_export = source_export?;
            if !TYPE_RESOLVER_ARGS {
                return None;
            }
            let source_type_name = format!("{parent_type_name}SourceType");
            ts.import_user_construct(
                &source_export.ts_module_path,
                source_export.export_name.as_deref(),
                &source_type_name,
                true,
            );
            Some(ts.type_reference(&source_type_name, vec![]))
        };
        let params = |ts: &mut TsAstBuilder<'a>, names: Vec<String>| {
            names
                .into_iter()
                .map(|name| {
                    if name == "source" {
                        let r#type = get_source_type_ref(ts);
                        return ts.param("source", r#type);
                    }
                    ts.param(&name, None)
                })
                .collect::<Vec<_>>()
        };
        Some(match resolver {
            ResolverDefinition::Property { name } => {
                let params = params(ts, vec!["source".to_string()]);
                let body = vec![ts.return_statement(ts.property_access(
                    ts.identifier("source"),
                    name.as_deref().unwrap_or(field_name),
                ))];
                ts.method(method_name, params, body, false)
            }
            ResolverDefinition::Method { name, arguments } => {
                let args = arguments.as_deref().unwrap_or_default();
                let is_async = args.iter().any(uses_async_derived_context);
                let params = params(ts, extract_used_params(args, true));
                let callee = ts.property_access(
                    ts.identifier("source"),
                    name.as_deref().unwrap_or(field_name),
                );
                let args = args
                    .iter()
                    .map(|arg| self.resolver_param(ts, arg))
                    .collect();
                let body = vec![ts.return_statement(ts.call(callee, args))];
                ts.method(method_name, params, body, is_async)
            }
            ResolverDefinition::Function {
                path,
                export_name,
                arguments,
            } => {
                let resolver_name = format_resolver_function_var_name(parent_type_name, field_name);
                ts.import_user_construct(path, export_name.as_deref(), &resolver_name, false);
                let args = arguments.as_deref().unwrap_or_default();
                let is_async = args.iter().any(uses_async_derived_context);
                let params = params(ts, extract_used_params(args, false));
                let args = args
                    .iter()
                    .map(|arg| self.resolver_param(ts, arg))
                    .collect();
                let body = vec![ts.return_statement(ts.call(ts.identifier(&resolver_name), args))];
                ts.method(method_name, params, body, is_async)
            }
            ResolverDefinition::StaticMethod {
                path,
                export_name,
                name,
                arguments,
            } => {
                // Note: This name is guaranteed to be unique, but for static methods, it
                // means we import the same class multiple times with multiple names.
                let resolver_name = format_resolver_function_var_name(parent_type_name, field_name);
                ts.import_user_construct(path, export_name.as_deref(), &resolver_name, false);
                let args = arguments.as_deref().unwrap_or_default();
                let is_async = args.iter().any(uses_async_derived_context);
                let params = params(ts, extract_used_params(args, false));
                let callee = ts.property_access(ts.identifier(&resolver_name), name);
                let args = args
                    .iter()
                    .map(|arg| self.resolver_param(ts, arg))
                    .collect();
                let body = vec![ts.return_statement(ts.call(callee, args))];
                ts.method(method_name, params, body, is_async)
            }
        })
    }

    fn is_default_resolver_signature(
        &self,
        field_name: &str,
        signature: &ResolverDefinition,
    ) -> bool {
        match signature {
            ResolverDefinition::Property { name } => {
                name.is_none() || name.as_deref() == Some(field_name)
            }
            ResolverDefinition::Method { name, arguments } => {
                if name.as_ref().is_some_and(|name| field_name != name) {
                    return false;
                }
                let Some(arguments) = arguments.as_ref().filter(|args| !args.is_empty()) else {
                    return true;
                };
                arguments.iter().enumerate().all(|(i, arg)| match i {
                    0 => matches!(arg, ResolverArgument::ArgumentsObject),
                    // TODO: More?
                    _ => false,
                })
            }
            ResolverDefinition::Function { .. } => false,
            ResolverDefinition::StaticMethod { .. } => false,
        }
    }

    // Either `args`, `context`, `info`, or a positional argument like
    // `args.someArg`.
    fn resolver_param<'a>(
        &mut self,
        ts: &mut TsAstBuilder<'a>,
        arg: &ResolverArgument,
    ) -> Expression<'a> {
        match arg {
            ResolverArgument::ArgumentsObject => ts.identifier("args"),
            ResolverArgument::Context => ts.identifier("context"),
            ResolverArgument::Information => ts.identifier("info"),
            ResolverArgument::Source => ts.identifier("source"),
            ResolverArgument::Named { name } => ts.property_access(ts.identifier("args"), name),
            ResolverArgument::DerivedContext {
                path,
                export_name,
                args,
                r#async,
            } => {
                let local_name = self.get_derived_context_name(ts, path, export_name.as_deref());
                ts.import_user_construct(path, export_name.as_deref(), &local_name, false);
                let args = args
                    .iter()
                    .map(|arg| self.resolver_param(ts, arg))
                    .collect();
                let call_expr = ts.call(ts.identifier(&local_name), args);
                // If the derived context is async, we need to await it
                if *r#async {
                    return Expression::new_await_expression(SPAN, call_expr, &*ts);
                }
                call_expr
            }
        }
    }

    // Derived contexts are not anchored to anything that we know to be
    // globally unique, like GraphQL type names, so must ensure this name is
    // unique within our module. However, we want to avoid generating a new
    // name for the same derived context more than once.
    fn get_derived_context_name(
        &mut self,
        ts: &mut TsAstBuilder,
        path: &str,
        export_name: Option<&str>,
    ) -> String {
        let key = format!("{path}:{}", export_name.unwrap_or(""));
        self.derived_context_names
            .entry(key)
            .or_insert_with(|| ts.get_unique_name(export_name.unwrap_or("deriveContext")))
            .clone()
    }

    // If a field is smantically non-null, we need to wrap the resolver in a
    // runtime check to ensure that the resolver does not return null.
    pub fn maybe_apply_semantic_null_runtime_check<'a>(
        &mut self,
        ts: &mut TsAstBuilder<'a>,
        field: &GraphQLField,
        method_: Option<ObjectPropertyKind<'a>>,
        method_name: &str,
    ) -> Option<ObjectPropertyKind<'a>> {
        let semantic_non_null = field_directive(field, SEMANTIC_NON_NULL_DIRECTIVE);
        if semantic_non_null.is_none() {
            return method_;
        }

        if !self.helpers.contains(ASSERT_NON_NULL_HELPER) {
            self.helpers.insert(ASSERT_NON_NULL_HELPER);
            let helper = create_assert_non_null_helper(ts);
            ts.add_helper(helper);
        }

        let mut method = method_.unwrap_or_else(|| self.default_resolver_method(ts, method_name));

        // PORT: The TypeScript implementation creates a copy of the method
        // with a new body. This replaces its return statements in place.
        let body_statements = match &mut method {
            ObjectPropertyKind::ObjectProperty(property) => match &mut property.value {
                Expression::FunctionExpression(function) => {
                    function.body.as_mut().map(|body| &mut body.statements)
                }
                _ => None,
            },
            ObjectPropertyKind::SpreadProperty(_) => None,
        };
        let Some(body_statements) = body_statements.filter(|statements| !statements.is_empty())
        else {
            panic!("Expected method to have a body");
        };
        let mut found_return = false;
        for statement in body_statements.iter_mut() {
            if let Statement::ReturnStatement(return_statement) = statement {
                found_return = true;
                // We need to wrap the return statement in a call to the runtime check
                let expression = null_throws(return_statement.argument.take());
                *statement = ts.return_statement(
                    ts.call(ts.identifier(ASSERT_NON_NULL_HELPER), vec![expression]),
                );
            }
        }
        if !found_return {
            panic!("Expected method to have a return statement");
        }
        Some(method)
    }

    fn default_resolver_method<'a>(
        &self,
        ts: &mut TsAstBuilder<'a>,
        method_name: &str,
    ) -> ObjectPropertyKind<'a> {
        ts.import(
            "graphql",
            vec![ImportSpecifier {
                name: "defaultFieldResolver".to_string(),
                r#as: None,
                is_type_only: false,
            }],
        );
        ts.method(
            method_name,
            RESOLVER_ARGS
                .iter()
                .map(|name| ts.param(name, None))
                .collect(),
            vec![
                ts.return_statement(
                    ts.call(
                        ts.identifier("defaultFieldResolver"),
                        RESOLVER_ARGS
                            .iter()
                            .map(|name| ts.identifier(name))
                            .collect(),
                    ),
                ),
            ],
            false,
        )
    }
}

// Here we try to avoid including unused args.
//
// Unused trailing args are trimmed, unused intermediate args are prefixed with
// an underscore.
fn extract_used_params(resolver_params: &[ResolverArgument], include_source: bool) -> Vec<String> {
    let mut wrapper_args: Vec<String> = Vec::new();

    let mut adding = false;
    for name in RESOLVER_ARGS.iter().rev() {
        let used = resolver_params.iter().any(|param| match *name {
            "source" => matches!(param, ResolverArgument::Source),
            "args" => matches!(
                param,
                ResolverArgument::Named { .. } | ResolverArgument::ArgumentsObject
            ),
            // Recursively check if this arg uses context.
            "context" => uses_context(param),
            "info" => matches!(param, ResolverArgument::Information),
            _ => panic!("Unexpected resolver kind {name}"),
        }) || (*name == "source" && include_source);

        if used {
            adding = true;
        }
        if !adding {
            continue;
        }

        wrapper_args.insert(
            0,
            if used {
                name.to_string()
            } else {
                format!("_{name}")
            },
        );
    }
    wrapper_args
}

// A param only uses context if it is the root context value, or if it is a
// derived context value that directly or transitively uses the root context
// value. So, we need a recursive function to check if a param uses context.
fn uses_context(param: &ResolverArgument) -> bool {
    match param {
        ResolverArgument::Context => true,
        ResolverArgument::DerivedContext { args, .. } => args.iter().any(uses_context),
        _ => false,
    }
}

// Check if any param is or uses an async derived context
fn uses_async_derived_context(param: &ResolverArgument) -> bool {
    match param {
        ResolverArgument::DerivedContext { r#async, args, .. } => {
            *r#async || args.iter().any(uses_async_derived_context)
        }
        _ => false,
    }
}

fn field_directive<'f>(field: &GraphQLField<'f>, name: &str) -> Option<&'f ConstDirectiveNode> {
    field
        .ast_node?
        .directives
        .as_ref()?
        .iter()
        .find(|d| d.name.value == name)
}

/// PORT: GraphQL names are ASCII, so this changes the case of the first
/// character with ASCII case mapping.
fn format_resolver_function_var_name(parent_type_name: &str, field_name: &str) -> String {
    let parent = parent_type_name[..1].to_ascii_lowercase() + &parent_type_name[1..];
    let field = field_name[..1].to_ascii_uppercase() + &field_name[1..];
    format!("{parent}{field}Resolver")
}
