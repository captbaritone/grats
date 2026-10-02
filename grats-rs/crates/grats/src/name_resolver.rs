use graphql_js::language::ast::Location;

use crate::snapshot_refs::{DeclLoc, DeclRef};

/// Answers the questions Grats needs to ask about what TypeScript names refer
/// to. Grats treats types nominally, so this is purely a matter of following
/// names (through imports and exports) to their declarations. No type
/// information is required.
pub trait NameResolver {
    /// Returns the declarations of the symbol referenced by the entity name at
    /// `name`, after following any aliases such as imports. Returns none if
    /// the name cannot be resolved.
    fn resolve_entity_name(&self, name: Location) -> Vec<ResolvedDeclaration>;

    /// Returns every declaration merged with `declaration` (including
    /// `declaration` itself). See
    /// https://www.typescriptlang.org/docs/handbook/declaration-merging.html
    fn merged_declarations(&self, declaration: &DeclRef) -> Vec<MergedDeclaration>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResolvedDeclarationKind {
    TypeParameter,
    Declaration,
}

#[derive(Debug, Clone)]
pub struct ResolvedDeclaration {
    pub kind: ResolvedDeclarationKind,
    pub decl_loc: DeclLoc,
    /// The whole declaration, for diagnostics.
    pub loc: Location,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MergedDeclarationKind {
    Interface,
    Class,
    Other,
}

#[derive(Debug, Clone)]
pub struct MergedDeclaration {
    pub kind: MergedDeclarationKind,
    pub decl_loc: DeclLoc,
    /// The declaration's name, or the whole declaration if it's anonymous.
    pub name: Location,
}
