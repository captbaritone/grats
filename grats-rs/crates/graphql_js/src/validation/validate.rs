//! Port of graphql-js `validation/validate.ts`.
//!
//! PORT: Only `validateSDL` is ported.

use crate::error::graphql_error::GraphQLError;
use crate::language::ast::DocumentNode;
use crate::language::visitor::{visit, visit_in_parallel};
use crate::validation::specified_rules::SPECIFIED_SDL_RULES;
use crate::validation::validation_context::SDLValidationContext;

/// PORT: graphql-js also takes a schema to extend and the rules to apply. Grats
/// never passes either, so the document is validated on its own, against the
/// specified SDL rules.
pub fn validate_sdl(document_ast: &DocumentNode) -> Vec<GraphQLError> {
    let context = SDLValidationContext::new(document_ast);
    let visitors = SPECIFIED_SDL_RULES
        .iter()
        .map(|rule| rule(&context))
        .collect();
    visit(document_ast, &mut visit_in_parallel(visitors));
    context.into_errors()
}
