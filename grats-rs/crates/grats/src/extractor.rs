//! Port of `src/Extractor.ts`.
//!
//! PORT: Only the constants and types used by ported code.

use std::collections::HashSet;

use serde::Deserialize;

use crate::snapshot_refs::{DeclLoc, DeclRef, EntityNameRef};
use crate::type_context::DeclarationDefinition;
use crate::utils::helpers::TsIdentifier;

pub const FIELD_TAG: &str = "gqlField";
pub const TYPE_TAG: &str = "gqlType";
pub const INTERFACE_TAG: &str = "gqlInterface";

pub const CONTEXT_TAG: &str = "gqlContext";
pub const INFO_TAG: &str = "gqlInfo";

pub const KILLS_PARENT_ON_EXCEPTION_TAG: &str = "killsParentOnException";

pub const OPERATION_TYPES: [&str; 3] = ["Query", "Mutation", "Subscription"];

/// PORT: The snapshot combined from each file's snapshot, by
/// `combineSnapshots` in `src/lib.ts`. Its definitions cross as the document.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractionSnapshot {
    /// Map from a GraphQL NameNode to the TypeScript type reference it was
    /// extracted from. Note that at extraction time we don't actually know the
    /// GraphQL name that this references, or if it even references a valid Grats
    /// type. So, the `NameNode` will generally have a placeholder name. This will
    /// be resolved in a later pass since it may reference a type defined in
    /// another file and extraction is done on a per-file basis.
    pub unresolved_names: Vec<(TsIdentifier, EntityNameRef)>,

    /// Map from a TypeScript declaration to the extracted GraphQL name and kind.
    pub name_definitions: Vec<(DeclLoc, NameDefinitionEntry)>,

    /// Some declarations (notably derived context functions) are not actually the
    /// declaration that will become a special GraphQL value, but rather they
    /// _reference_ a type which will implicitly become a special type to Grats.
    pub implicit_name_definitions: Vec<(DeclarationDefinition, EntityNameRef)>,

    /// Records which named GraphQL types define a `__typename` field.
    /// This is used to ensure all types which are members of an abstract type
    /// (union or interface) define a `__typename` field which is required to
    /// determine their GraphQL type at runtime.
    pub types_with_typename: HashSet<String>,

    /// TypeScript interfaces which have been used to define GraphQL types. This is
    /// used in a later validation pass to ensure we never use merged interfaces,
    /// since merged interfaces have surprising behaviors which can lead to bugs.
    pub interface_declarations: Vec<DeclRef>,
}

/// PORT: `{ declaration: DeclRef; definition: NameDefinition }`.
#[derive(Debug, Deserialize)]
pub struct NameDefinitionEntry {
    pub declaration: DeclRef,
    pub definition: DeclarationDefinition,
}
