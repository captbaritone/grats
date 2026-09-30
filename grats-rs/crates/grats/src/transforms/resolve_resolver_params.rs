//! Port of `src/transforms/resolveResolverParams.ts`.

use graphql_js::language::ast::{
    DefinitionNode, FieldDefinitionNode, InputValueDefinitionNode, Location, NullableTypeNode,
    ResolverArgument, ResolverSignature, TsDiagnosticResult,
};
use indexmap::IndexMap;

use crate::errors as E;
use crate::graphql_constructor::nullable_type;
use crate::type_context::{
    DeclarationDefinition, DeclarationDefinitionKind, TypeContext, UNRESOLVED_REFERENCE_NAME,
};
use crate::utils::diagnostic_error::{Diagnostic, DiagnosticsResult, gql_err, gql_related};
use crate::utils::helpers::{invariant, null_throws};

/// PORT: TypeScript uses graphql-js's `visit` to replace field definitions with
/// transformed copies. The Rust visitor can't edit the AST, so this transforms
/// field definitions in place, walking to every field definition.
pub fn resolve_resolver_params(
    ctx: &TypeContext,
    definitions: Vec<DefinitionNode>,
) -> DiagnosticsResult<Vec<DefinitionNode>> {
    let resolver = ResolverParamsResolver::new(ctx);
    resolver.resolve(definitions)
}

struct ResolverParamsResolver<'a> {
    ctx: &'a TypeContext<'a>,
    errors: Vec<Diagnostic>,
}

impl<'a> ResolverParamsResolver<'a> {
    fn new(ctx: &'a TypeContext<'a>) -> Self {
        ResolverParamsResolver {
            ctx,
            errors: Vec::new(),
        }
    }

    fn resolve(
        mut self,
        mut definitions: Vec<DefinitionNode>,
    ) -> DiagnosticsResult<Vec<DefinitionNode>> {
        for def in &mut definitions {
            for field in field_definitions(def) {
                self.transform_field(field);
            }
            // Note: If we wanted to provide custom error messages when you try to
            // consume context/info/etc from a directive, we would do that here.
        }

        if !self.errors.is_empty() {
            return Err(self.errors);
        }
        Ok(definitions)
    }

    /// PORT: Edits the field in place, rather than returning a new one.
    fn transform_field(&mut self, field: &mut FieldDefinitionNode) {
        let resolver = null_throws(field.resolver.as_mut());

        let resolver_arguments = match resolver {
            ResolverSignature::Property { .. } => return,
            ResolverSignature::Method { arguments, .. }
            | ResolverSignature::Function { arguments, .. }
            | ResolverSignature::StaticMethod { arguments, .. } => arguments,
        };
        let Some(arguments) = resolver_arguments else {
            return;
        };

        // Resolve all the params individually
        let mut resolver_params: Vec<ResolverArgument> = Vec::new();
        for param in arguments.iter() {
            let Some(transformed) = self.transform_param(param, None) else {
                return;
            };
            resolver_params.push(transformed);
        }

        // Now we check to see if the params are a valid combination...
        let args = resolver_params
            .iter()
            .find(|param| matches!(param, ResolverArgument::ArgumentsObject { .. }));
        let positional_args: Vec<&ResolverArgument> = resolver_params
            .iter()
            .filter(|param| matches!(param, ResolverArgument::Named { .. }))
            .collect();

        if let Some(args) = args
            && !positional_args.is_empty()
        {
            self.errors.push(gql_err(
                args.loc(),
                E::positional_arg_and_args_object(),
                Some(vec![gql_related(
                    positional_args[0].loc(),
                    "Positional GraphQL argument defined here",
                )]),
            ));
            return;
        }

        let mut field_args: Vec<InputValueDefinitionNode> =
            field.arguments.take().unwrap_or_default();

        // Add any positional args to the field's arguments
        for positional_arg in positional_args {
            if let ResolverArgument::Named {
                input_definition, ..
            } = positional_arg
            {
                field_args.push(input_definition.clone());
            }
        }

        *arguments = resolver_params;
        field.arguments = Some(field_args);
    }

    fn transform_param(
        &mut self,
        param: &ResolverArgument,
        seen_derived_context_values: Option<&mut IndexMap<String, Option<Location>>>,
    ) -> Option<ResolverArgument> {
        match param {
            ResolverArgument::Named { .. }
            | ResolverArgument::ArgumentsObject { .. }
            | ResolverArgument::Information { .. }
            | ResolverArgument::Context { .. }
            | ResolverArgument::DerivedContext { .. }
            | ResolverArgument::Source { .. } => Some(param.clone()),
            ResolverArgument::Unresolved {
                input_definition,
                loc,
            } => {
                let unwrapped_type = nullable_type(input_definition.r#type.clone());
                if let NullableTypeNode::NamedType(unwrapped_type) = unwrapped_type
                    && unwrapped_type.name.value == UNRESOLVED_REFERENCE_NAME
                {
                    let resolved = match self
                        .ctx
                        .gql_name_definition_for_gql_name(&unwrapped_type.name)
                    {
                        Err(err) => {
                            self.errors.push(err);
                            return None;
                        }
                        Ok(resolved) => resolved,
                    };
                    return match resolved.kind {
                        DeclarationDefinitionKind::DerivedContext => self.resolve_derived_context(
                            *loc,
                            resolved,
                            seen_derived_context_values,
                        ),
                        DeclarationDefinitionKind::Context => {
                            Some(ResolverArgument::Context { loc: *loc })
                        }
                        DeclarationDefinitionKind::Info => {
                            Some(ResolverArgument::Information { loc: *loc })
                        }
                        _ => {
                            // We'll assume it's supposed to be a positional arg.
                            Some(
                                self.resolve_to_positional_arg(param)
                                    .unwrap_or_else(|| param.clone()),
                            )
                        }
                    };
                }
                // This can't be a context or info param so we'll assume it's supposed
                // to be a positional arg.
                Some(
                    self.resolve_to_positional_arg(param)
                        .unwrap_or_else(|| param.clone()),
                )
            }
        }
    }

    fn resolve_derived_context(
        &mut self,
        loc: Option<Location>, // Argument
        definition: &'a DeclarationDefinition,
        seen_derived_context_values: Option<&mut IndexMap<String, Option<Location>>>,
    ) -> Option<ResolverArgument> {
        let derived_context = null_throws(definition.derived_context.as_ref());
        let path = &derived_context.path;
        let export_name = &derived_context.export_name;
        let args = &derived_context.args;
        let r#async = derived_context.r#async;
        // Like the template literal in TypeScript, which prints `null`.
        let key = format!("{path}:{}", export_name.as_deref().unwrap_or("null"));
        let mut new_map = IndexMap::new();
        let seen_derived_context_values = match seen_derived_context_values {
            // We're resolving the arg of a resolver. Initiate the map.
            None => &mut new_map,
            Some(seen_derived_context_values) => {
                if seen_derived_context_values.contains_key(&key) {
                    let error = self.cycle_error(loc, definition, seen_derived_context_values);
                    self.errors.push(error);
                    return None;
                }
                seen_derived_context_values
            }
        };
        seen_derived_context_values.insert(key, loc);

        let mut new_args: Vec<ResolverArgument> = Vec::new();
        for arg in args {
            let Some(resolved_arg) =
                self.transform_param(arg, Some(&mut *seen_derived_context_values))
            else {
                continue;
            };
            match resolved_arg {
                ResolverArgument::Context { .. } => new_args.push(resolved_arg),
                // Here we know that the argument `node` maps to a derived context
                // `definition` which itself depends another derived resolver `resolvedArg`.
                // `definition`.
                ResolverArgument::DerivedContext { .. } => new_args.push(resolved_arg),
                _ => self.errors.push(gql_err(
                    resolved_arg.loc(),
                    E::invalid_derived_context_arg_type(),
                    None,
                )),
            }
        }
        Some(ResolverArgument::DerivedContext {
            loc,
            path: path.clone(),
            export_name: export_name.clone(),
            args: new_args,
            r#async,
        })
    }

    fn resolve_to_positional_arg(
        &mut self,
        unresolved: &ResolverArgument,
    ) -> Option<ResolverArgument> {
        let ResolverArgument::Unresolved {
            input_definition,
            loc,
        } = unresolved
        else {
            panic!("Expected an unresolved resolver argument");
        };
        let name = match &input_definition.name {
            TsDiagnosticResult::Error { err } => {
                self.errors.push(Diagnostic::Ts(*err));
                return None;
            }
            TsDiagnosticResult::Ok { value } => value,
        };
        Some(ResolverArgument::Named {
            name: name.value.clone(),
            input_definition: InputValueDefinitionNode {
                loc: input_definition.loc,
                description: input_definition.description.clone(),
                name: name.clone(),
                r#type: input_definition.r#type.clone(),
                default_value: input_definition.default_value.clone(),
                directives: input_definition.directives.clone(),
            },
            loc: *loc,
        })
    }

    /// Some slightly complicated logic to construct nice errors in the case of
    /// cycles where derived resolvers ultimately depend upon themselves.
    ///
    /// The `@gqlContext` tag is the main location. If it's a direct cycle, we
    /// report one related location, of the argument which points back to itself.
    ///
    /// If there are multiple nodes in the cycle, we report a related location for
    /// each node in the cycle, with a message that depends on the position of the
    /// node in the cycle.
    fn cycle_error(
        &self,
        loc: Option<Location>,
        definition: &DeclarationDefinition,
        seen_derived_context_values: &IndexMap<String, Option<Location>>,
    ) -> Diagnostic {
        // We trim off the first node because that points to a resolver argument.
        let mut locs: Vec<Option<Location>> = seen_derived_context_values
            .values()
            .skip(1)
            .copied()
            .collect();
        // The cycle completes with this node, so we include it in the list.
        locs.push(loc);
        let related = locs
            .iter()
            .enumerate()
            .map(|(i, def)| {
                if locs.len() == 1 {
                    return gql_related(*def, "This derived context depends on itself");
                }

                let is_first = i == 0;
                let is_last = i == locs.len() - 1;

                invariant(!(is_first && is_last), "Should not be both first and last");

                if is_first {
                    return gql_related(*def, "This derived context depends on");
                } else if !is_last {
                    return gql_related(*def, "Which in turn depends on");
                }
                gql_related(
                    *def,
                    "Which ultimately creates a cycle back to the initial derived context",
                )
            })
            .collect();
        gql_err(
            definition.name.loc,
            E::cyclic_derived_context(),
            Some(related),
        )
    }
}

/// PORT: The field definitions `visit` would call the visitor with.
fn field_definitions(def: &mut DefinitionNode) -> Vec<&mut FieldDefinitionNode> {
    let fields = match def {
        DefinitionNode::ObjectTypeDefinition(def) => &mut def.fields,
        DefinitionNode::ObjectTypeExtension(def) => &mut def.fields,
        DefinitionNode::InterfaceTypeDefinition(def) => &mut def.fields,
        DefinitionNode::InterfaceTypeExtension(def) => &mut def.fields,
        _ => return Vec::new(),
    };
    fields.iter_mut().flatten().collect()
}
