//! Port of `src/CheckerNameResolver.ts`.
//!
//! PORT: The TypeScript checker only exists on the TypeScript side, so it
//! answers ahead of time for everything ported code may ask about (see
//! `CheckerNameResolution`), and this resolver looks up those answers. The
//! Rust name resolver (plan Step 7) will replace it.

use std::collections::HashMap;

use graphql_js::language::ast::Location;
use serde::Deserialize;

use crate::name_resolver::{MergedDeclaration, NameResolver, ResolvedDeclaration};
use crate::snapshot_refs::{DeclLoc, DeclRef};

/// PORT: The checker's answers, from `resolveNamesForRust` in
/// `src/rs/nameResolution.ts`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckerNameResolution {
    /// For each entity name in the snapshot, and those in their type
    /// arguments.
    pub resolved_entity_names: Vec<(Location, Vec<ResolvedDeclaration>)>,
    /// For each of the snapshot's interface declarations.
    pub merged_declarations: Vec<(DeclLoc, Vec<MergedDeclaration>)>,
}

pub struct CheckerNameResolver {
    resolved_entity_names: HashMap<Location, Vec<ResolvedDeclaration>>,
    merged_declarations: HashMap<DeclLoc, Vec<MergedDeclaration>>,
}

impl CheckerNameResolver {
    pub fn new(resolution: CheckerNameResolution) -> Self {
        CheckerNameResolver {
            resolved_entity_names: resolution.resolved_entity_names.into_iter().collect(),
            merged_declarations: resolution.merged_declarations.into_iter().collect(),
        }
    }
}

impl NameResolver for CheckerNameResolver {
    fn resolve_entity_name(&self, name: Location) -> Vec<ResolvedDeclaration> {
        self.resolved_entity_names
            .get(&name)
            .cloned()
            .unwrap_or_else(|| panic!("Expected the entity name at {name:?} to be resolved."))
    }

    fn merged_declarations(&self, declaration: &DeclRef) -> Vec<MergedDeclaration> {
        self.merged_declarations
            .get(&declaration.decl_loc)
            .cloned()
            .unwrap_or_else(|| {
                panic!(
                    "Expected the declarations merged with {} to be resolved.",
                    declaration.decl_loc
                )
            })
    }
}
