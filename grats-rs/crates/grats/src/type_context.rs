//! Port of `src/TypeContext.ts`.

use std::collections::HashMap;

use graphql_js::language::ast::{Location, NameNode, ResolverArgument};
use serde::Deserialize;

use crate::errors::{self as E, ContextOrInfo};
use crate::extractor::{ExtractionSnapshot, NameDefinitionEntry};
use crate::name_resolver::{NameResolver, ResolvedDeclaration, ResolvedDeclarationKind};
use crate::snapshot_refs::{DeclLoc, DeclRef, EntityNameRef};
use crate::utils::diagnostic_error::{
    Diagnostic, DiagnosticResult, DiagnosticsResult, gql_err, gql_related,
};
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
/// `kind`. The rest of a `DerivedResolverDefinition` is in `derived_context`.
#[derive(Debug, Deserialize)]
pub struct DeclarationDefinition {
    pub name: NameNode,
    pub kind: DeclarationDefinitionKind,
    /// Present if `kind` is `DerivedContext`.
    #[serde(flatten)]
    pub derived_context: Option<DerivedResolverDefinition>,
}

/// PORT: The fields of `DerivedResolverDefinition` besides `name` and `kind`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DerivedResolverDefinition {
    pub path: String,
    pub export_name: Option<String>,
    pub args: Vec<ResolverArgument>,
    pub r#async: bool,
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
pub struct TypeContext<'r> {
    resolver: &'r dyn NameResolver,

    declaration_to_definition: HashMap<DeclLoc, DeclarationDefinition>,
    unresolved_nodes: HashMap<TsIdentifier, EntityNameRef>,
    id_to_declaration: HashMap<TsIdentifier, DeclRef>,
}

impl<'r> TypeContext<'r> {
    pub fn from_snapshot(
        resolver: &'r dyn NameResolver,
        snapshot: ExtractionSnapshot,
    ) -> DiagnosticsResult<Self> {
        let mut errors: Vec<Diagnostic> = Vec::new();
        let mut self_ = TypeContext::new(resolver);
        self_.unresolved_nodes = snapshot.unresolved_names.into_iter().collect();
        for (
            _,
            NameDefinitionEntry {
                declaration,
                definition,
            },
        ) in snapshot.name_definitions
        {
            let decl_loc = declaration.decl_loc.clone();
            self_
                .id_to_declaration
                .insert(definition.name.ts_identifier, declaration);
            self_.declaration_to_definition.insert(decl_loc, definition);
        }
        for (definition, reference) in snapshot.implicit_name_definitions {
            let Some(declaration) = self_.maybe_declaration_for_ts_name(reference.name) else {
                errors.push(gql_err(
                    Some(reference.name),
                    E::unresolved_type_reference(),
                    None,
                ));
                continue;
            };
            if let Some(existing) = self_.declaration_to_definition.get(&declaration.decl_loc) {
                errors.push(gql_err(
                    Some(declaration.loc),
                    "Multiple derived contexts defined for given type".to_string(),
                    Some(vec![
                        gql_related(definition.name.loc, "One was defined here"),
                        gql_related(existing.name.loc, "Another here"),
                    ]),
                ));
                continue;
            }
            self_
                .declaration_to_definition
                .insert(declaration.decl_loc, definition);
        }

        if !errors.is_empty() {
            return Err(errors);
        }
        Ok(self_)
    }

    fn new(resolver: &'r dyn NameResolver) -> Self {
        TypeContext {
            resolver,
            declaration_to_definition: HashMap::new(),
            unresolved_nodes: HashMap::new(),
            id_to_declaration: HashMap::new(),
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

    /// Checks if an unresolved NameNode refers to a GraphQL type
    pub fn unresolved_name_is_graphql(&self, unresolved: &NameNode) -> bool {
        let Some(reference_node) = self.get_entity_name(unresolved) else {
            return false;
        };
        let Some(declaration) = self.maybe_declaration_for_ts_name(reference_node.name) else {
            return false;
        };
        self.declaration_to_definition
            .contains_key(&declaration.decl_loc)
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

    // Note! This assumes you have already handled any type parameters.
    pub fn gql_name_for_ts_name(&self, name: Location) -> DiagnosticResult<String> {
        let declaration = self.resolve_entity_name(name)?;
        if declaration.kind == ResolvedDeclarationKind::TypeParameter {
            return Err(gql_err(
                Some(name),
                "Type parameter not valid".to_string(),
                Some(vec![gql_related(Some(declaration.loc), "Defined here")]),
            ));
        }

        let Some(name_definition) = self.declaration_to_definition.get(&declaration.decl_loc)
        else {
            return Err(gql_err(Some(name), E::unresolved_type_reference(), None));
        };
        let context_or_info = match name_definition.kind {
            DeclarationDefinitionKind::Context => Some(ContextOrInfo::Context),
            DeclarationDefinitionKind::Info => Some(ContextOrInfo::Info),
            _ => None,
        };
        if let Some(kind) = context_or_info {
            return Err(gql_err(
                Some(name),
                E::context_or_info_used_in_graphql_position(kind),
                Some(vec![gql_related(name_definition.name.loc, "Defined here")]),
            ));
        }
        Ok(name_definition.name.value.clone())
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

    /// Gets the TypeScript declaration for a GraphQL definition node
    /// Currently used exclusively for taking a GraphQL declaration and
    /// finding its TypeScript declaration in order to find generic type
    /// parameters.
    ///
    /// PORT: Takes the definition's name, which is all it reads.
    pub fn declaration_for_gql_definition(&self, name: &NameNode) -> &DeclRef {
        let Some(declaration) = self.id_to_declaration.get(&name.ts_identifier) else {
            panic!("Could not find declaration for {}", name.value);
        };
        declaration
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
