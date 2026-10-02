//! Port of graphql-js `utilities/typeComparators.ts`.
//!
//! PORT: Only the comparators used by ported code.

use crate::r#type::definition::{GraphQLNamedType, GraphQLType};
use crate::r#type::schema::GraphQLSchema;

/// Provided two types, return true if the types are equal (invariant).
pub fn is_equal_type(type_a: &GraphQLType, type_b: &GraphQLType) -> bool {
    // Equivalent types are equal.
    // PORT: graphql-js compares by identity. Named types are compared by id,
    // and wrapping types which are structurally equal compare equal below.
    if type_a == type_b {
        return true;
    }

    match (type_a, type_b) {
        // If either type is non-null, the other must also be non-null.
        (GraphQLType::NonNull(a), GraphQLType::NonNull(b)) => is_equal_type(a, b),
        // If either type is a list, the other must also be a list.
        (GraphQLType::List(a), GraphQLType::List(b)) => is_equal_type(a, b),
        // Otherwise the types are not equal.
        _ => false,
    }
}

/// Provided a type and a super type, return true if the first type is either
/// equal or a subset of the second super type (covariant).
pub fn is_type_sub_type_of(
    schema: &GraphQLSchema,
    maybe_sub_type: &GraphQLType,
    super_type: &GraphQLType,
) -> bool {
    // Equivalent type is a valid subtype
    // PORT: See `is_equal_type`.
    if maybe_sub_type == super_type {
        return true;
    }

    // If superType is non-null, maybeSubType must also be non-null.
    if let GraphQLType::NonNull(super_of_type) = super_type {
        if let GraphQLType::NonNull(sub_of_type) = maybe_sub_type {
            return is_type_sub_type_of(schema, sub_of_type, super_of_type);
        }
        return false;
    }
    if let GraphQLType::NonNull(sub_of_type) = maybe_sub_type {
        // If superType is nullable, maybeSubType may be non-null or nullable.
        return is_type_sub_type_of(schema, sub_of_type, super_type);
    }

    // If superType type is a list, maybeSubType type must also be a list.
    if let GraphQLType::List(super_of_type) = super_type {
        if let GraphQLType::List(sub_of_type) = maybe_sub_type {
            return is_type_sub_type_of(schema, sub_of_type, super_of_type);
        }
        return false;
    }
    if maybe_sub_type.is_list_type() {
        // If superType is not a list, maybeSubType must also be not a list.
        return false;
    }

    // If superType type is an abstract type, check if it is super type of maybeSubType.
    // Otherwise, the child type is not a valid subtype of the parent type.
    let (GraphQLType::Named(super_type), GraphQLType::Named(maybe_sub_type)) =
        (super_type, maybe_sub_type)
    else {
        unreachable!("Wrapping types are handled above.");
    };
    schema[*super_type].is_abstract_type()
        && matches!(
            schema[*maybe_sub_type],
            GraphQLNamedType::Interface(_) | GraphQLNamedType::Object(_)
        )
        && schema.is_sub_type(*super_type, *maybe_sub_type)
}
