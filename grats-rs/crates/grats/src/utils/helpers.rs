//! Port of `src/utils/helpers.ts`.

pub fn null_throws<T>(value: Option<T>) -> T {
    value.expect(
        "Grats Error. Expected value to be non-nullish. This error represents an error in Grats. Please report it.",
    )
}
