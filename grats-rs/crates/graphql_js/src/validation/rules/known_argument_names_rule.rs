//! Port of graphql-js `validation/rules/KnownArgumentNamesRule.ts`.
//!
//! PORT: Only `KnownArgumentNamesOnDirectivesRule` is ported, since fields
//! with arguments only exist in executable documents.

use std::collections::HashMap;

use crate::error::graphql_error::GraphQLError;
use crate::jsutils::did_you_mean::did_you_mean;
use crate::jsutils::suggestion_list::suggestion_list;
use crate::language::ast::DefinitionNode;
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::r#type::directives::specified_directives;
use crate::validation::validation_context::SDLValidationContext;

/// PORT: There is no schema being extended (see `SDLValidationContext`), so
/// the defined directives are the specified directives.
pub fn known_argument_names_on_directives_rule<'c, 'n>(
    context: &'c SDLValidationContext<'n>,
) -> Box<dyn ASTVisitor<'n> + 'c> {
    let mut directive_args: HashMap<&'n str, Vec<&'n str>> = HashMap::new();

    let defined_directives = specified_directives();
    for directive in defined_directives {
        directive_args.insert(
            directive.name,
            directive.args.iter().map(|arg| arg.name).collect(),
        );
    }

    let ast_definitions = &context.get_document().definitions;
    for def in ast_definitions {
        if let DefinitionNode::DirectiveDefinition(def) = def {
            // FIXME: https://github.com/graphql/graphql-js/issues/2203
            let args_nodes = def.arguments.as_deref().unwrap_or_default();

            directive_args.insert(
                &def.name.value,
                args_nodes
                    .iter()
                    .map(|arg| arg.name.value.as_str())
                    .collect(),
            );
        }
    }

    Box::new(KnownArgumentNamesOnDirectivesRule {
        context,
        directive_args,
    })
}

struct KnownArgumentNamesOnDirectivesRule<'c, 'n> {
    context: &'c SDLValidationContext<'n>,
    directive_args: HashMap<&'n str, Vec<&'n str>>,
}

impl<'n> ASTVisitor<'n> for KnownArgumentNamesOnDirectivesRule<'_, 'n> {
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        let ASTNode::Directive(directive_node) = node else {
            return VisitAction::Continue;
        };
        let directive_name = directive_node.name.value.as_str();
        let known_args = self.directive_args.get(directive_name);

        if let (Some(arguments), Some(known_args)) = (&directive_node.arguments, known_args) {
            for arg_node in arguments {
                let arg_name = arg_node.name.value.as_str();
                if !known_args.contains(&arg_name) {
                    let suggestions = suggestion_list(arg_name, known_args.iter().copied());
                    self.context.report_error(GraphQLError::new(
                        format!(
                            "Unknown argument \"{arg_name}\" on directive \"@{directive_name}\"."
                        ) + &did_you_mean(None, &suggestions),
                        vec![arg_node.loc],
                    ));
                }
            }
        }

        VisitAction::Skip
    }
}
