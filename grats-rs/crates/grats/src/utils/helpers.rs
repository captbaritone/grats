//! Port of `src/utils/helpers.ts`.

/// PORT: Declared in `graphql_js`, whose AST nodes carry them.
pub use graphql_js::language::ast::{TsIdentifier, UNTRACKED_ID};

pub fn null_throws<T>(value: Option<T>) -> T {
    value.expect(
        "Grats Error. Expected value to be non-nullish. This error represents an error in Grats. Please report it.",
    )
}

/// PORT: Takes the item's `ast_node`, rather than the item.
pub fn ast_node<T>(ast_node: Option<T>) -> T {
    ast_node.expect("Expected item to have astNode")
}

pub fn invariant(condition: bool, message: &str) {
    if !condition {
        panic!(
            "Grats Error. Invariant failed: {message}. This error represents an error in Grats. Please report it."
        );
    }
}
