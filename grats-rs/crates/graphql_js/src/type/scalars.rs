//! Port of graphql-js `type/scalars.ts`.
//!
//! PORT: graphql-js exports the specified scalars as `GraphQLScalarType`
//! objects. Until the type system is ported only their names are needed.

pub const SPECIFIED_SCALAR_TYPE_NAMES: [&str; 5] = ["String", "Int", "Float", "Boolean", "ID"];
