//! Port of `src/Errors.ts`.
//!
//! PORT: Only the messages used by ported code.

use crate::extractor::{FIELD_TAG, KILLS_PARENT_ON_EXCEPTION_TAG, TYPE_TAG};

pub fn generic_type_used_as_union_member() -> String {
    "Unexpected generic type used as union member. Generic type may not currently be used as members of a union. Grats requires that all union members define a `__typename` field typed as a string literal matching the type's name. Since generic types are synthesized into multiple types with different names, Grats cannot ensure they have a correct `__typename` property and thus cannot be used as members of a union.".to_string()
}

pub fn generic_type_implements_interface() -> String {
    format!(
        "Unexpected `implements` on generic `{TYPE_TAG}`. Generic types may not currently declare themselves as implementing interfaces. Grats requires that all types which implement an interface define a `__typename` field typed as a string literal matching the type's name. Since generic types are synthesized into multiple types with different names, Grats cannot ensure they have a correct `__typename` property and thus declare themselves as interface implementors."
    )
}

pub fn concrete_typename_implementing_interface_cannot_be_resolved(
    implementor: &str,
    interface_name: &str,
) -> String {
    format!(
        "Cannot resolve typename. The type `{implementor}` implements `{interface_name}`, so it must either have a `__typename` property or be an exported class."
    )
}

pub fn concrete_typename_in_union_cannot_be_resolved(
    implementor: &str,
    union_name: &str,
) -> String {
    format!(
        "Cannot resolve typename. The type `{implementor}` is a member of `{union_name}`, so it must either have a `__typename` property or be an exported class."
    )
}

pub fn no_types_defined() -> String {
    format!(
        "Grats could not find any GraphQL types defined in this project.\n\nDeclare a type by adding a `/** @{TYPE_TAG} */` docblock above a class, interface, or type alias declaration.\nGrats looks for docblock tags in any TypeScript file included in your TypeScript project."
    )
}

// TODO: Add code action
pub fn kills_parent_on_exception_with_wrong_config() -> String {
    format!(
        "Unexpected `@{KILLS_PARENT_ON_EXCEPTION_TAG}` tag. `@{KILLS_PARENT_ON_EXCEPTION_TAG}` is only supported when the Grats config option `nullableByDefault` is enabled in your `tsconfig.json`."
    )
}

// TODO: Add code action
pub fn kills_parent_on_exception_on_nullable() -> String {
    format!(
        "Unexpected `@{KILLS_PARENT_ON_EXCEPTION_TAG}` tag on field typed as nullable. `@{KILLS_PARENT_ON_EXCEPTION_TAG}` will force a field to appear as non-nullable in the schema, so its implementation must also be non-nullable. ."
    )
}

pub fn subscription_field_not_async_iterable() -> String {
    "Expected fields on `Subscription` to return an `AsyncIterable`. Fields on `Subscription` model a subscription, which is a stream of events. Grats expects fields on `Subscription` to return an `AsyncIterable` which can be used to model this stream.".to_string()
}

pub fn type_with_no_fields(kind: &str, type_name: &str) -> String {
    format!(
        "{kind} `{type_name}` must define one or more fields.\n\nDefine a field by adding `/** @{FIELD_TAG} */` above a field, property, attribute or method of this type, or above a function that has `{type_name}` as its first argument."
    )
}
