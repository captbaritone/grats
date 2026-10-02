use graphql_js::language::ast::{
    DefinitionNode, DiagnosticHandle, DiagnosticHandleResult, FieldDefinitionNode,
    InputValueDefinitionNode, InputValueDefinitionNodeOrResolverArg, Location, NullableTypeNode,
    ResolverArgument, ResolverSignature,
};
use indexmap::IndexMap;
use rustc_hash::FxHashMap;

use crate::errors as E;
use crate::graphql_constructor::nullable_type;
use crate::type_context::{
    DeclarationDefinition, DeclarationDefinitionKind, TypeContext, UNRESOLVED_REFERENCE_NAME,
};
use crate::utils::diagnostic_error::{Diagnostic, DiagnosticsResult, gql_err, gql_related};
use crate::utils::result::ok_unless_errors;

/// Resolves the parameters of each field's resolver to the context, info, a
/// derived context, or a positional GraphQL argument, which is added to the
/// field's arguments. Takes the diagnostics which the definitions'
/// `DiagnosticHandle`s refer to (see `ExtractionSnapshot::diagnostics_by_handle`).
pub fn resolve_resolver_params(
    ctx: &TypeContext,
    diagnostics_by_handle: &FxHashMap<DiagnosticHandle, Diagnostic>,
    definitions: Vec<DefinitionNode>,
) -> DiagnosticsResult<Vec<DefinitionNode>> {
    let resolver = ResolverParamsResolver {
        ctx,
        diagnostics_by_handle,
        errors: Vec::new(),
    };
    resolver.resolve(definitions)
}

/// The derived contexts being resolved, from the outermost inwards, keyed by
/// their module path and export name, with the location of the parameter
/// which depends on each.
type SeenDerivedContexts = IndexMap<(String, Option<String>), Option<Location>>;

struct ResolverParamsResolver<'a> {
    ctx: &'a TypeContext<'a>,
    diagnostics_by_handle: &'a FxHashMap<DiagnosticHandle, Diagnostic>,
    errors: Vec<Diagnostic>,
}

impl<'a> ResolverParamsResolver<'a> {
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

        ok_unless_errors(self.errors, definitions)
    }

    fn transform_field(&mut self, field: &mut FieldDefinitionNode) {
        let resolver = field
            .resolver
            .as_mut()
            .expect("Expected field to have a resolver");
        let (ResolverSignature::Method { arguments, .. }
        | ResolverSignature::Function { arguments, .. }
        | ResolverSignature::StaticMethod { arguments, .. }) = resolver
        else {
            return;
        };
        let Some(arguments) = arguments else {
            return;
        };

        // Resolve all the params individually
        let Some(resolver_params) = arguments
            .iter()
            .map(|param| self.transform_param(param, None))
            .collect::<Option<Vec<_>>>()
        else {
            return;
        };

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

        let mut field_args = field.arguments.take().unwrap_or_default();

        // Add any positional args to the field's arguments
        field_args.extend(positional_args.into_iter().filter_map(|arg| match arg {
            ResolverArgument::Named {
                input_definition, ..
            } => Some(input_definition.clone()),
            _ => None,
        }));

        *arguments = resolver_params;
        field.arguments = Some(field_args);
    }

    fn transform_param(
        &mut self,
        param: &ResolverArgument,
        seen_derived_contexts: Option<&mut SeenDerivedContexts>,
    ) -> Option<ResolverArgument> {
        let ResolverArgument::Unresolved {
            input_definition,
            loc,
        } = param
        else {
            return Some(param.clone());
        };
        if let NullableTypeNode::NamedType(unwrapped_type) =
            nullable_type(input_definition.r#type.clone())
            && unwrapped_type.name.value == UNRESOLVED_REFERENCE_NAME
        {
            let definition = match self
                .ctx
                .gql_name_definition_for_gql_name(&unwrapped_type.name)
            {
                Err(err) => {
                    self.errors.push(err);
                    return None;
                }
                Ok(definition) => definition,
            };
            match definition.kind {
                DeclarationDefinitionKind::DerivedContext => {
                    return self.resolve_derived_context(*loc, definition, seen_derived_contexts);
                }
                DeclarationDefinitionKind::Context => {
                    return Some(ResolverArgument::Context { loc: *loc });
                }
                DeclarationDefinitionKind::Info => {
                    return Some(ResolverArgument::Information { loc: *loc });
                }
                _ => {}
            }
        }
        // This isn't a context or info param, so we'll assume it's supposed to
        // be a positional arg.
        Some(
            self.resolve_to_positional_arg(input_definition, *loc)
                .unwrap_or_else(|| param.clone()),
        )
    }

    fn resolve_derived_context(
        &mut self,
        loc: Option<Location>, // Argument
        definition: &'a DeclarationDefinition,
        seen_derived_contexts: Option<&mut SeenDerivedContexts>,
    ) -> Option<ResolverArgument> {
        let derived_context = definition
            .derived_context
            .as_ref()
            .expect("Expected derived context definition to have a derived context");
        let key = (
            derived_context.path.clone(),
            derived_context.export_name.clone(),
        );
        let mut new_map = IndexMap::new();
        let seen_derived_contexts = match seen_derived_contexts {
            // We're resolving the arg of a resolver. Initiate the map.
            None => &mut new_map,
            Some(seen_derived_contexts) => {
                if seen_derived_contexts.contains_key(&key) {
                    let error = cycle_error(loc, definition, seen_derived_contexts);
                    self.errors.push(error);
                    return None;
                }
                seen_derived_contexts
            }
        };
        seen_derived_contexts.insert(key, loc);

        let mut args = Vec::new();
        for arg in &derived_context.args {
            let Some(resolved_arg) = self.transform_param(arg, Some(&mut *seen_derived_contexts))
            else {
                continue;
            };
            match resolved_arg {
                ResolverArgument::Context { .. } | ResolverArgument::DerivedContext { .. } => {
                    args.push(resolved_arg);
                }
                _ => self.errors.push(gql_err(
                    resolved_arg.loc(),
                    E::invalid_derived_context_arg_type(),
                    None,
                )),
            }
        }
        Some(ResolverArgument::DerivedContext {
            loc,
            path: derived_context.path.clone(),
            export_name: derived_context.export_name.clone(),
            args,
            r#async: derived_context.r#async,
        })
    }

    fn resolve_to_positional_arg(
        &mut self,
        input_definition: &InputValueDefinitionNodeOrResolverArg,
        loc: Option<Location>,
    ) -> Option<ResolverArgument> {
        let name = match &input_definition.name {
            DiagnosticHandleResult::Error { err } => {
                self.errors.push(self.diagnostics_by_handle[err].clone());
                return None;
            }
            DiagnosticHandleResult::Ok { value } => value,
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
            loc,
        })
    }
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
    loc: Option<Location>,
    definition: &DeclarationDefinition,
    seen_derived_contexts: &SeenDerivedContexts,
) -> Diagnostic {
    // We trim off the first node because that points to a resolver argument.
    let mut locs: Vec<Option<Location>> = seen_derived_contexts.values().skip(1).copied().collect();
    // The cycle completes with this node, so we include it in the list.
    locs.push(loc);
    let last = locs.len() - 1;
    let related = locs
        .iter()
        .enumerate()
        .map(|(i, &loc)| {
            let message = if last == 0 {
                "This derived context depends on itself"
            } else if i == 0 {
                "This derived context depends on"
            } else if i < last {
                "Which in turn depends on"
            } else {
                "Which ultimately creates a cycle back to the initial derived context"
            };
            gql_related(loc, message)
        })
        .collect();
    gql_err(
        definition.name.loc,
        E::cyclic_derived_context(),
        Some(related),
    )
}

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
