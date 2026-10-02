//! Port of graphql-js `validation/rules/ProvidedRequiredArgumentsRule.ts`.
//!
//! PORT: Only `ProvidedRequiredArgumentsOnDirectivesRule` is ported, since
//! fields with arguments only exist in executable documents.

use indexmap::IndexMap;
use rustc_hash::{FxHashMap, FxHashSet};

use crate::error::graphql_error::GraphQLError;
use crate::jsutils::key_map::key_map;
use crate::language::ast::{DefinitionNode, InputValueDefinitionNode, TypeNode};
use crate::language::printer::print_type;
use crate::language::visitor::{ASTNode, ASTVisitor};
use crate::r#type::definition::{GraphQLArgument, TypeArena, is_required_argument};
use crate::r#type::directives::specified_directives;
use crate::validation::validation_context::SDLValidationContext;

/// PORT: graphql-js stores either kind of argument definition, and tells them
/// apart with `isType(argDef.type)`.
enum ArgDef<'n> {
    Argument(&'static GraphQLArgument<'static>),
    Node(&'n InputValueDefinitionNode),
}

/// PORT: There is no schema being extended (see `SDLValidationContext`), so
/// the defined directives are the specified directives.
pub fn provided_required_arguments_on_directives_rule<'c, 'n>(
    context: &'c SDLValidationContext<'n>,
) -> Box<dyn ASTVisitor<'n> + 'c> {
    let mut required_args_map: FxHashMap<&'n str, IndexMap<&'n str, ArgDef<'n>>> =
        FxHashMap::default();

    let defined_directives = specified_directives();
    for directive in defined_directives {
        required_args_map.insert(
            directive.name,
            key_map(
                directive
                    .args
                    .iter()
                    .filter(|arg| is_required_argument(arg)),
                |arg| arg.name,
            )
            .into_iter()
            .map(|(name, arg)| (name, ArgDef::Argument(arg)))
            .collect(),
        );
    }

    let ast_definitions = &context.get_document().definitions;
    for def in ast_definitions {
        if let DefinitionNode::DirectiveDefinition(def) = def {
            // FIXME: https://github.com/graphql/graphql-js/issues/2203
            let arg_nodes = def.arguments.as_deref().unwrap_or_default();

            required_args_map.insert(
                &def.name.value,
                key_map(
                    arg_nodes
                        .iter()
                        .filter(|arg| is_required_argument_node(arg)),
                    |arg| arg.name.value.as_str(),
                )
                .into_iter()
                .map(|(name, arg)| (name, ArgDef::Node(arg)))
                .collect(),
            );
        }
    }

    Box::new(ProvidedRequiredArgumentsOnDirectivesRule {
        context,
        required_args_map,
    })
}

struct ProvidedRequiredArgumentsOnDirectivesRule<'c, 'n> {
    context: &'c SDLValidationContext<'n>,
    required_args_map: FxHashMap<&'n str, IndexMap<&'n str, ArgDef<'n>>>,
}

impl<'n> ASTVisitor<'n> for ProvidedRequiredArgumentsOnDirectivesRule<'_, 'n> {
    // Validate on leave to allow for deeper errors to appear first.
    fn leave(&mut self, node: ASTNode<'n>) {
        let ASTNode::Directive(directive_node) = node else {
            return;
        };
        let directive_name = directive_node.name.value.as_str();
        let required_args = self.required_args_map.get(directive_name);
        if let Some(required_args) = required_args {
            // FIXME: https://github.com/graphql/graphql-js/issues/2203
            let arg_nodes = directive_node.arguments.as_deref().unwrap_or_default();
            let arg_node_map: FxHashSet<&str> = arg_nodes
                .iter()
                .map(|arg| arg.name.value.as_str())
                .collect();
            for (arg_name, arg_def) in required_args {
                if !arg_node_map.contains(arg_name) {
                    let arg_type = match arg_def {
                        // PORT: graphql-js's `inspect` of a type prints its
                        // name, which is read from the type's arena. The
                        // specified directives' arguments have specified
                        // scalar types, which every arena holds.
                        ArgDef::Argument(arg_def) => arg_def.r#type.inspect(&TypeArena::new()),
                        ArgDef::Node(arg_def) => print_type(&arg_def.r#type),
                    };
                    self.context.report_error(GraphQLError::new(
                        format!(
                            "Directive \"@{directive_name}\" argument \"{arg_name}\" of type \"{arg_type}\" is required, but it was not provided."
                        ),
                        vec![directive_node.loc],
                    ));
                }
            }
        }
    }
}

fn is_required_argument_node(arg: &InputValueDefinitionNode) -> bool {
    matches!(arg.r#type, TypeNode::NonNullType(_)) && arg.default_value.is_none()
}
