use std::collections::HashMap;

use graphql_js::language::ast::{Location, NameNode, ResolverArgument, TsIdentifier};

use crate::errors::{self as E, ContextOrInfo};
use crate::extractor::NameDefinitionEntry;
use crate::name_resolver::{NameResolver, ResolvedDeclaration, ResolvedDeclarationKind};
use crate::snapshot_refs::{DeclLoc, DeclRef, EntityNameRef};
use crate::utils::diagnostic_error::{
    Diagnostic, DiagnosticResult, DiagnosticsResult, gql_err, gql_related,
};
use crate::utils::result::ok_unless_errors;

pub const UNRESOLVED_REFERENCE_NAME: &str = "__UNRESOLVED_REFERENCE__";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

/// What a declaration defines: a GraphQL construct, the context or info type,
/// or a derived context.
#[derive(Debug)]
pub struct DeclarationDefinition {
    pub name: NameNode,
    pub kind: DeclarationDefinitionKind,
    /// Present if `kind` is `DerivedContext`.
    pub derived_context: Option<DerivedResolverDefinition>,
}

/// The resolver function which derives a derived context.
#[derive(Debug)]
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
    /// Indexes the definitions and references of an `ExtractionSnapshot`.
    pub fn new(
        resolver: &'r dyn NameResolver,
        unresolved_names: Vec<(TsIdentifier, EntityNameRef)>,
        name_definitions: Vec<(DeclLoc, NameDefinitionEntry)>,
        implicit_name_definitions: Vec<(DeclarationDefinition, EntityNameRef)>,
    ) -> DiagnosticsResult<Self> {
        let mut errors: Vec<Diagnostic> = Vec::new();
        let mut type_context = TypeContext {
            resolver,
            declaration_to_definition: HashMap::new(),
            unresolved_nodes: unresolved_names.into_iter().collect(),
            id_to_declaration: HashMap::new(),
        };
        for (
            _,
            NameDefinitionEntry {
                declaration,
                definition,
            },
        ) in name_definitions
        {
            let decl_loc = declaration.decl_loc.clone();
            type_context
                .id_to_declaration
                .insert(definition.name.ts_identifier, declaration);
            type_context
                .declaration_to_definition
                .insert(decl_loc, definition);
        }
        for (definition, reference) in implicit_name_definitions {
            let Some(declaration) = type_context.maybe_declaration_for_ts_name(reference.name)
            else {
                errors.push(gql_err(
                    Some(reference.name),
                    E::unresolved_type_reference(),
                    None,
                ));
                continue;
            };
            if let Some(existing) = type_context
                .declaration_to_definition
                .get(&declaration.decl_loc)
            {
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
            type_context
                .declaration_to_definition
                .insert(declaration.decl_loc, definition);
        }

        ok_unless_errors(errors, type_context)
    }

    fn find_declaration(
        &self,
        mut declarations: Vec<ResolvedDeclaration>,
    ) -> Option<ResolvedDeclaration> {
        // When a symbol has multiple declarations (e.g., `const X` and `type X`
        // sharing a name), prefer the one registered in the GraphQL schema.
        let registered = declarations
            .iter()
            .position(|decl| self.declaration_to_definition.contains_key(&decl.decl_loc));
        match registered {
            Some(index) => Some(declarations.swap_remove(index)),
            None => declarations.into_iter().next(),
        }
    }

    /// Checks if an unresolved NameNode refers to a GraphQL type
    pub fn unresolved_name_is_graphql(&self, unresolved: &NameNode) -> bool {
        self.get_entity_name(unresolved)
            .and_then(|reference| self.definition_for_ts_name(reference.name))
            .is_some()
    }

    /// Gets the declaration definition for a GraphQL NameNode
    pub fn gql_name_definition_for_gql_name(
        &self,
        name_node: &NameNode,
    ) -> DiagnosticResult<&DeclarationDefinition> {
        let reference = self
            .get_entity_name(name_node)
            .expect("Expected to find reference node for name node.");
        self.definition_for_ts_name(reference.name)
            .ok_or_else(|| gql_err(name_node.loc, E::unresolved_type_reference(), None))
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
        let kind = match name_definition.kind {
            DeclarationDefinitionKind::Context => ContextOrInfo::Context,
            DeclarationDefinitionKind::Info => ContextOrInfo::Info,
            _ => return Ok(name_definition.name.value.clone()),
        };
        Err(gql_err(
            Some(name),
            E::context_or_info_used_in_graphql_position(kind),
            Some(vec![gql_related(name_definition.name.loc, "Defined here")]),
        ))
    }

    /// The definition of the declaration a TypeScript entity name refers to.
    fn definition_for_ts_name(&self, name: Location) -> Option<&DeclarationDefinition> {
        let declaration = self.maybe_declaration_for_ts_name(name)?;
        self.declaration_to_definition.get(&declaration.decl_loc)
    }

    fn maybe_declaration_for_ts_name(&self, name: Location) -> Option<ResolvedDeclaration> {
        self.find_declaration(self.resolver.resolve_entity_name(name))
    }

    /// Resolves a TypeScript entity name to the declaration it refers to.
    pub fn resolve_entity_name(&self, name: Location) -> DiagnosticResult<ResolvedDeclaration> {
        self.maybe_declaration_for_ts_name(name)
            .ok_or_else(|| gql_err(Some(name), E::unresolved_type_reference(), None))
    }

    /// Gets the TypeScript declaration for a GraphQL definition node
    /// Currently used exclusively for taking a GraphQL declaration and
    /// finding its TypeScript declaration in order to find generic type
    /// parameters.
    pub fn declaration_for_gql_definition(&self, name: &NameNode) -> &DeclRef {
        self.id_to_declaration
            .get(&name.ts_identifier)
            .unwrap_or_else(|| panic!("Could not find declaration for {}", name.value))
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
