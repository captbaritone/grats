//! Port of `src/publicDirectives.ts`.
//!
//! Grats supports some additional, non-spec server directives in order to
//! support experimental GraphQL features. This module contains the definition(s)
//! of those directives.
//!
//! PORT: Only the parts used by ported code are ported so far.

pub const SEMANTIC_NON_NULL_DIRECTIVE: &str = "semanticNonNull";
