//! Port of `src/TypeContext.ts`.
//!
//! PORT: Only the parts used by ported code. Until `fromSnapshot` is ported,
//! the TypeScript side builds its `TypeContext` and this one is built from its
//! state (see `TypeContextState`).

use std::collections::HashMap;

use graphql_js::language::ast::{Location, NameNode};
use serde::Deserialize;

use crate::checker_name_resolver::CheckerNameResolver;
use crate::errors::{self as E, ContextOrInfo};
use crate::name_resolver::{NameResolver, ResolvedDeclaration, ResolvedDeclarationKind};
use crate::snapshot_refs::{DeclLoc, EntityNameRef};
use crate::utils::diagnostic_error::{DiagnosticResult, gql_err, gql_related};
use crate::utils::helpers::TsIdentifier;

pub const UNRESOLVED_REFERENCE_NAME: &str = "__UNRESOLVED_REFERENCE__";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DeclarationDefinitionKind {
    Type,
    Interface,
    Union,
    Scalar,
    InputObject,
    Enum,
    Context,
    Info,
    DerivedContext,
}

/// PORT: `NameDefinition | DerivedResolverDefinition`, which share `name` and
/// `kind`. The other fields of `DerivedResolverDefinition` are modeled once
/// ported code reads them.
#[derive(Debug, Deserialize)]
pub struct DeclarationDefinition {
    pub name: NameNode,
    pub kind: DeclarationDefinitionKind,
}

/// PORT: The state of the TypeScript side's `TypeContext`, which this one is
/// built from until `fromSnapshot` is ported.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeContextState {
    pub declaration_to_definition: Vec<(DeclLoc, DeclarationDefinition)>,
    pub unresolved_nodes: Vec<(TsIdentifier, EntityNameRef)>,
    /// The checker's answers for `CheckerNameResolver`.
    pub resolved_entity_names: Vec<(Location, Vec<ResolvedDeclaration>)>,
}

/// Used to track TypeScript references.
///
/// If a TS method is typed as returning `MyType`, we need to look at that type's
/// GQLType annotation to find out its name. However, we may not have seen that
/// class yet.
///
/// So, we employ a two pass approach. When we encounter a reference to a type
/// we model it as a dummy type reference in the GraphQL AST. Then, after we've
/// parsed all the files, we traverse the GraphQL schema, resolving all the dummy
/// type references.
pub struct TypeContext {
    resolver: Box<dyn NameResolver>,

    declaration_to_definition: HashMap<DeclLoc, DeclarationDefinition>,
    unresolved_nodes: HashMap<TsIdentifier, EntityNameRef>,
}

impl TypeContext {
    pub fn from_state(state: TypeContextState) -> Self {
        TypeContext {
            resolver: Box::new(CheckerNameResolver::new(state.resolved_entity_names)),
            declaration_to_definition: state.declaration_to_definition.into_iter().collect(),
            unresolved_nodes: state.unresolved_nodes.into_iter().collect(),
        }
    }

    fn find_declaration(
        &self,
        mut declarations: Vec<ResolvedDeclaration>,
    ) -> Option<ResolvedDeclaration> {
        if declarations.is_empty() {
            return None;
        }
        // When a symbol has multiple declarations (e.g., `const X` and `type X`
        // sharing a name), prefer the one registered in the GraphQL schema.
        if declarations.len() > 1 {
            let registered = declarations
                .iter()
                .position(|decl| self.declaration_to_definition.contains_key(&decl.decl_loc));
            if let Some(index) = registered {
                return Some(declarations.swap_remove(index));
            }
        }
        Some(declarations.swap_remove(0))
    }

    /// Resolves an unresolved NameNode to its actual GraphQL name
    pub fn resolve_unresolved_named_type(
        &self,
        unresolved: &NameNode,
    ) -> DiagnosticResult<NameNode> {
        if unresolved.value != UNRESOLVED_REFERENCE_NAME {
            return Ok(unresolved.clone());
        }
        let Some(type_reference) = self.get_entity_name(unresolved) else {
            panic!("Unexpected unresolved reference name.");
        };

        let declaration = self.resolve_entity_name(type_reference.name)?;
        if declaration.kind == ResolvedDeclarationKind::TypeParameter {
            return Err(gql_err(
                unresolved.loc,
                "Type parameters are not supported in this context.".to_string(),
                None,
            ));
        }

        let Some(name_definition) = self.declaration_to_definition.get(&declaration.decl_loc)
        else {
            return Err(gql_err(
                unresolved.loc,
                E::unresolved_type_reference(),
                None,
            ));
        };
        let context_or_info = match name_definition.kind {
            DeclarationDefinitionKind::Context => Some(ContextOrInfo::Context),
            DeclarationDefinitionKind::Info => Some(ContextOrInfo::Info),
            _ => None,
        };
        if let Some(kind) = context_or_info {
            return Err(gql_err(
                unresolved.loc,
                E::context_or_info_used_in_graphql_position(kind),
                Some(vec![gql_related(name_definition.name.loc, "Defined here")]),
            ));
        }
        Ok(NameNode {
            value: name_definition.name.value.clone(),
            ..unresolved.clone()
        })
    }

    /// Gets the declaration definition for a GraphQL NameNode
    pub fn gql_name_definition_for_gql_name(
        &self,
        name_node: &NameNode,
    ) -> DiagnosticResult<&DeclarationDefinition> {
        let Some(reference_node) = self.get_entity_name(name_node) else {
            panic!("Expected to find reference node for name node.");
        };

        let Some(declaration) = self.maybe_declaration_for_ts_name(reference_node.name) else {
            return Err(gql_err(name_node.loc, E::unresolved_type_reference(), None));
        };
        let Some(definition) = self.declaration_to_definition.get(&declaration.decl_loc) else {
            return Err(gql_err(name_node.loc, E::unresolved_type_reference(), None));
        };
        Ok(definition)
    }

    fn maybe_declaration_for_ts_name(&self, name: Location) -> Option<ResolvedDeclaration> {
        self.find_declaration(self.resolver.resolve_entity_name(name))
    }

    /// Resolves a TypeScript entity name to the declaration it refers to.
    pub fn resolve_entity_name(&self, name: Location) -> DiagnosticResult<ResolvedDeclaration> {
        let Some(declaration) = self.maybe_declaration_for_ts_name(name) else {
            return Err(gql_err(Some(name), E::unresolved_type_reference(), None));
        };
        Ok(declaration)
    }

    /// Gets the TypeScript entity name associated with a GraphQL NameNode
    pub fn get_entity_name(&self, name: &NameNode) -> Option<&EntityNameRef> {
        let entity_name = self.unresolved_nodes.get(&name.ts_identifier);
        if entity_name.is_none() && name.value == UNRESOLVED_REFERENCE_NAME {
            panic!("Expected unresolved reference to have a node.");
        }
        entity_name
    }
}
