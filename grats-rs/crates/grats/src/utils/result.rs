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
    if !errors.is_empty() {
        return Err(errors);
    }
    Ok(values)
}
