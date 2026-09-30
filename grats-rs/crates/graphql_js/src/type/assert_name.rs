//! Port of graphql-js `type/assertName.ts`.
//!
//! PORT: Only `assertName` is ported.

use crate::error::graphql_error::GraphQLError;
use crate::language::character_classes::{is_name_continue, is_name_start};

/// Upholds the spec rules about naming.
///
/// PORT: Returns the error graphql-js throws.
pub fn assert_name(name: &str) -> Result<&str, GraphQLError> {
    // PORT: Characters are UTF-16 code units, as in JavaScript.
    let units: Vec<u16> = name.encode_utf16().collect();
    if units.is_empty() {
        return Err(GraphQLError::new(
            "Expected name to be a non-empty string.".to_string(),
            Vec::new(),
        ));
    }

    for &unit in &units[1..] {
        if !is_name_continue(Some(unit)) {
            return Err(GraphQLError::new(
                format!("Names must only contain [_a-zA-Z0-9] but \"{name}\" does not."),
                Vec::new(),
            ));
        }
    }

    if !is_name_start(Some(units[0])) {
        return Err(GraphQLError::new(
            format!("Names must start with [_a-zA-Z] but \"{name}\" does not."),
            Vec::new(),
        ));
    }

    Ok(name)
}
