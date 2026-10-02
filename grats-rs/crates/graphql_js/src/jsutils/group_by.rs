//! Port of graphql-js `jsutils/groupBy.ts`.

use std::hash::Hash;

use indexmap::IndexMap;

/// Groups array items into a Map, given a function to produce grouping key.
///
/// PORT: A JavaScript `Map` iterates in insertion order, like an `IndexMap`.
pub fn group_by<K: Hash + Eq, T>(
    list: impl IntoIterator<Item = T>,
    key_fn: impl Fn(&T) -> K,
) -> IndexMap<K, Vec<T>> {
    let mut result: IndexMap<K, Vec<T>> = IndexMap::new();
    for item in list {
        let key = key_fn(&item);
        result.entry(key).or_default().push(item);
    }
    result
}
