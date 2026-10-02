//! Port of graphql-js `jsutils/keyMap.ts`.

use std::hash::Hash;

use indexmap::IndexMap;

/// Creates a keyed JS object from an array, given a function to produce the keys
/// for each value in the array.
///
/// This provides a convenient lookup for the array items if the key function
/// produces unique results.
///
/// PORT: graphql-js returns an object. Its keys are GraphQL names, which can't
/// look like array indices, so JavaScript iterates them in insertion order,
/// like an `IndexMap`. Assigning an existing key keeps its position in both.
pub fn key_map<K: Hash + Eq, T>(
    list: impl IntoIterator<Item = T>,
    key_fn: impl Fn(&T) -> K,
) -> IndexMap<K, T> {
    let mut result = IndexMap::new();
    for item in list {
        result.insert(key_fn(&item), item);
    }
    result
}
