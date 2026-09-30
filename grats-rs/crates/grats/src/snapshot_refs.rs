//! Port of `src/snapshotRefs.ts`.
//!
//! Plain-data handles which the extractor records in an `ExtractionSnapshot`
//! in place of TypeScript AST nodes. They capture everything later passes need
//! to know about a node syntactically. Anything that requires knowing what a
//! name refers to is answered by `TypeContext`.
//!
//! PORT: Only the parts used by ported code. The functions which record refs
//! from TypeScript nodes stay on the TypeScript side with the extractor.

use graphql_js::language::ast::Location;
use serde::Deserialize;

/// Identifies a TypeScript declaration by the file and position at which it is
/// declared. Two `DeclLoc`s are equal if and only if they identify the same
/// declaration.
pub type DeclLoc = String;

/// A declaration which defines a GraphQL construct, or a TypeScript interface
/// used to define one.
///
/// PORT: Fields are modeled once ported code reads them.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeclRef {
    pub decl_loc: DeclLoc,
    /// Used to materialize generic types.
    pub type_parameters: Vec<TypeParameterRef>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeParameterRef {
    pub decl_loc: DeclLoc,
    pub name: String,
    /// The whole type parameter declaration, including any constraint.
    pub loc: Location,
}

/// A reference to a TypeScript type by name, such as `Foo`, `ns.Foo` or
/// `Foo<Bar>`, which may reference a GraphQL type.
///
/// PORT: `kind: "ENTITY_NAME"` is modeled by `TypeArgumentRef`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityNameRef {
    /// The name being referenced, e.g. `ns.Foo` in `ns.Foo<Bar>`.
    pub name: Location,
    /// The whole reference, including any type arguments.
    pub loc: Location,
    pub type_arguments: Option<Vec<TypeArgumentRef>>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TypeArgumentRef {
    EntityName(EntityNameRef),
    OtherType { loc: Location },
}
