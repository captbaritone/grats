//! Port of `src/CheckerNameResolver.ts`.
//!
//! PORT: The TypeScript checker only exists on the TypeScript side, so it
//! answers ahead of time for every name `TypeContext` may ask about (see
//! `TypeContextState`), and this resolver looks up those answers. The Rust
//! name resolver (plan Step 7) will replace it.

use std::collections::HashMap;

use graphql_js::language::ast::Location;

use crate::name_resolver::{NameResolver, ResolvedDeclaration};

pub struct CheckerNameResolver {
    resolved_entity_names: HashMap<Location, Vec<ResolvedDeclaration>>,
}

impl CheckerNameResolver {
    pub fn new(
        resolved_entity_names: impl IntoIterator<Item = (Location, Vec<ResolvedDeclaration>)>,
    ) -> Self {
        CheckerNameResolver {
            resolved_entity_names: resolved_entity_names.into_iter().collect(),
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
}
