/// Collects the values of `results`, or, if any failed, every one of their
/// errors.
pub fn collect_results<C: FromIterator<T>, T, E>(
    results: impl IntoIterator<Item = Result<T, Vec<E>>>,
) -> Result<C, Vec<E>> {
    let mut errors: Vec<E> = Vec::new();
    let values = results
        .into_iter()
        .filter_map(|result| result.map_err(|err| errors.extend(err)).ok())
        .collect();
    ok_unless_errors(errors, values)
}

/// `value`, or, if there are any, `errors`.
pub fn ok_unless_errors<T, E>(errors: Vec<E>, value: T) -> Result<T, Vec<E>> {
    if errors.is_empty() {
        Ok(value)
    } else {
        Err(errors)
    }
}
