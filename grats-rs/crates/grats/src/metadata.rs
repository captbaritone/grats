//! Port of `src/metadata.ts`.
//!
//! Grats extracts a GraphQL schema from your TypeScript source code, but it also
//! infers additional non-Schema information, such as the signature of your
//! resolves.
//!
//! In order to allow external tools to make use of Grats' analysis, we are
//! are EXPERIMENTING with exposing the result of Grats' analysis as JSON. This
//! file contains the TypeScript types describing that shape.
//!
//! PORT: These types deserialize from that JSON. Objects are `IndexMap`s since
//! codegen iterates them in insertion order, as JavaScript does for keys which
//! aren't array indices, which GraphQL names can't be.

use indexmap::IndexMap;
use serde::Deserialize;

/// Metadata for the full schema
#[derive(Debug, Deserialize)]
pub struct Metadata {
    /// Types in the schema
    pub types: IndexMap<String, IndexMap<String, FieldDefinition>>,
}

/// A GraphQL field
#[derive(Debug, Deserialize)]
pub struct FieldDefinition {
    pub resolver: ResolverDefinition,
}

/// Information about the resolver for this field. Should be sufficient to either
/// dynamically invoke the resolver at runtime (inefficiently) or codegen JavaScript
/// to define the resolver function.
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ResolverDefinition {
    /// A field which is simply backed by a property (or getter) on the source object
    Property {
        /// If omitted the field name is the same as the property name
        name: Option<String>,
    },
    /// A field which is backed by a function exported from a module. This is the
    /// most flexible kind of resolver.
    #[serde(rename_all = "camelCase")]
    Function {
        /// Path to the module
        path: String,
        /// Name of the export. If omitted the function is the default export.
        export_name: Option<String>,
        arguments: Option<Vec<ResolverArgument>>,
    },
    /// A field which is backed by a method on the source object
    Method {
        /// Method name. If omitted, the method name is the same as the field name
        name: Option<String>,
        arguments: Option<Vec<ResolverArgument>>,
    },
    /// A field which is backed by a static method on a class exported from a module
    #[serde(rename_all = "camelCase")]
    StaticMethod {
        /// Path to the module
        path: String,
        /// Export name. If omitted, the class is the default export
        export_name: Option<String>,
        /// Method name
        name: String,
        arguments: Option<Vec<ResolverArgument>>,
    },
}

/// An argument expected by a resolver function or method
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ResolverArgument {
    /// The source or parent object
    Source,
    /// An arguments object containing all the field arguments
    ArgumentsObject,
    /// The GraphQL context
    Context,
    /// A context value which is expressed as a function of the global context
    #[serde(rename_all = "camelCase")]
    DerivedContext {
        /// Path to the module
        path: String,
        /// Export name. If omitted, the class is the default export
        export_name: Option<String>,
        /// PORT: `ContextArgs` in TypeScript, which only allows context and
        /// derived context arguments.
        args: Vec<ResolverArgument>,
        r#async: bool,
    },
    /// The GraphQL info object
    Information,
    /// A single named GraphQL argument
    Named {
        /// Name of the GraphQL field argument
        name: String,
    },
}
