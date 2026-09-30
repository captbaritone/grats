//! Port of `src/utils/Result.ts`.
//!
//! PORT: Only `collectResults` and `concatResults`. Rust's `Result` covers the
//! rest.

pub fn collect_results<T, E>(
    results: impl IntoIterator<Item = Result<T, Vec<E>>>,
) -> Result<Vec<T>, Vec<E>> {
    let mut errors: Vec<E> = Vec::new();
    let mut values: Vec<T> = Vec::new();
    for result in results {
        match result {
            Err(err) => errors.extend(err),
            Ok(value) => values.push(value),
        }
    }
    if !errors.is_empty() {
        return Err(errors);
    }
    Ok(values)
}

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
