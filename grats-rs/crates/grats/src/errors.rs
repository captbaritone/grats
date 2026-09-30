//! Port of `src/Errors.ts`.
//!
//! PORT: Only the messages used by ported code.

use crate::extractor::TYPE_TAG;

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
