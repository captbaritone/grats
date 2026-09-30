//! PORT: No TypeScript counterpart. The sources which locations refer to by
//! id: the files of the program, and the GraphQL parsed from docblocks (each
//! `@gqlAnnotate` tag's arguments get their own "GraphQL request" source).
//! The TypeScript implementation's locations referenced their graphql-js
//! `Source` instead.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Sources are identified by name and text rather than by name alone, since
/// GraphQL parsed from docblocks shares a name.
#[derive(Debug, Default)]
pub struct SourceTable {
    inner: Mutex<Inner>,
}

#[derive(Debug, Default)]
struct Inner {
    sources: Vec<Arc<Source>>,
    ids_by_name: HashMap<String, Vec<u32>>,
}

#[derive(Debug)]
pub struct Source {
    pub name: String,
    pub body: String,
}

impl SourceTable {
    /// The id of the source, which is added to the table if it's not already
    /// there. Sources must be added before they're parsed, so that locations
    /// in the parsed document can refer to them.
    pub fn add(&self, name: &str, body: &str) -> u32 {
        let mut inner = self.inner.lock().expect("The source table is poisoned");
        let Inner {
            sources,
            ids_by_name,
        } = &mut *inner;
        let ids = ids_by_name.entry(name.to_string()).or_default();
        if let Some(&id) = ids.iter().find(|&&id| sources[id as usize].body == body) {
            return id;
        }
        let id = u32::try_from(sources.len()).expect("Source ids should fit in a u32");
        sources.push(Arc::new(Source {
            name: name.to_string(),
            body: body.to_string(),
        }));
        ids.push(id);
        id
    }

    /// The source with id `id`.
    pub fn get(&self, id: u32) -> Arc<Source> {
        let inner = self.inner.lock().expect("The source table is poisoned");
        inner
            .sources
            .get(id as usize)
            .cloned()
            .unwrap_or_else(|| panic!("Unknown source id {id}."))
    }
}
