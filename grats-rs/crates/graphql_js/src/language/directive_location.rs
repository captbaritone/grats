//! Port of graphql-js `language/directiveLocation.ts`.
//!
//! PORT: graphql-js defines a string enum. Directives built from SDL store
//! their locations as the strings found in the document, without checking
//! them, so the set of allowed directive location values is modeled as string
//! constants.

// Request Definitions
pub const QUERY: &str = "QUERY";
pub const MUTATION: &str = "MUTATION";
pub const SUBSCRIPTION: &str = "SUBSCRIPTION";
pub const FIELD: &str = "FIELD";
pub const FRAGMENT_DEFINITION: &str = "FRAGMENT_DEFINITION";
pub const FRAGMENT_SPREAD: &str = "FRAGMENT_SPREAD";
pub const INLINE_FRAGMENT: &str = "INLINE_FRAGMENT";
pub const VARIABLE_DEFINITION: &str = "VARIABLE_DEFINITION";
// Type System Definitions
pub const SCHEMA: &str = "SCHEMA";
pub const SCALAR: &str = "SCALAR";
pub const OBJECT: &str = "OBJECT";
pub const FIELD_DEFINITION: &str = "FIELD_DEFINITION";
pub const ARGUMENT_DEFINITION: &str = "ARGUMENT_DEFINITION";
pub const INTERFACE: &str = "INTERFACE";
pub const UNION: &str = "UNION";
pub const ENUM: &str = "ENUM";
pub const ENUM_VALUE: &str = "ENUM_VALUE";
pub const INPUT_OBJECT: &str = "INPUT_OBJECT";
pub const INPUT_FIELD_DEFINITION: &str = "INPUT_FIELD_DEFINITION";
