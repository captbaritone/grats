//! Port of `src/utils/helpers.ts`.

pub fn null_throws<T>(value: Option<T>) -> T {
    value.expect(
        "Grats Error. Expected value to be non-nullish. This error represents an error in Grats. Please report it.",
    )
}

/// PORT: Takes the item's `ast_node`, rather than the item.
pub fn ast_node<T>(ast_node: Option<T>) -> T {
    ast_node.expect("Expected item to have astNode")
}
