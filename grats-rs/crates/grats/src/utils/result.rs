//! Port of `src/utils/Result.ts`.
//!
//! PORT: Only `concatResults`. Rust's `Result` covers the rest.

pub fn concat_results<T, U, E>(
    result1: Result<T, Vec<E>>,
    result2: Result<U, Vec<E>>,
) -> Result<(T, U), Vec<E>> {
    match (result1, result2) {
        (Err(mut err1), Err(err2)) => {
            err1.extend(err2);
            Err(err1)
        }
        (Err(err), _) | (_, Err(err)) => Err(err),
        (Ok(value1), Ok(value2)) => Ok((value1, value2)),
    }
}
