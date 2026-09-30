//! Port of `src/NameResolver.ts`.

use graphql_js::language::ast::Location;
use serde::Deserialize;

use crate::snapshot_refs::DeclLoc;

/// Answers the questions Grats needs to ask about what TypeScript names refer
/// to. Grats treats types nominally, so this is purely a matter of following
/// names (through imports and exports) to their declarations. No type
/// information is required.
///
/// PORT: `mergedDeclarations` is ported once ported code calls it.
pub trait NameResolver {
    /// Returns the declarations of the symbol referenced by the entity name at
    /// `name`, after following any aliases such as imports. Returns an empty
    /// array if the name cannot be resolved.
    fn resolve_entity_name(&self, name: Location) -> Vec<ResolvedDeclaration>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ResolvedDeclarationKind {
    TypeParameter,
    Declaration,
}

/// PORT: `loc` is modeled once ported code reads it.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedDeclaration {
    pub kind: ResolvedDeclarationKind,
    pub decl_loc: DeclLoc,
}
