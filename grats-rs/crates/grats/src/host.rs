//! PORT: No TypeScript counterpart. What the Rust port of Grats asks of its
//! host about the program's files. Until Rust owns the file set (plan Steps 8
//! and 9), the TypeScript side answers from its `ts.Program`. See
//! `src/rs/host.ts`.

use serde::{Deserialize, Serialize};

pub trait Host {
    /// The file of a source in the TypeScript side's `SourceTable`, which
    /// locations refer to.
    fn source_file(&self, source: u32) -> File;

    /// A file in the program, whose source is added to the `SourceTable` if
    /// it's not already there. `None` if the file isn't in the program.
    fn read_file(&self, path: &str) -> Option<File>;

    /// The path of the file in the program which `specifier` resolves to when
    /// imported by the file at `from`, as TypeScript resolves it.
    fn resolve_module(&self, from: &str, specifier: &str) -> Option<String>;

    /// The files which may declare `name` in the global scope, in the order
    /// in which TypeScript merges their declarations: files which aren't
    /// modules (including lib files), followed by modules with
    /// `declare global` blocks.
    fn global_files(&self, name: &str) -> Vec<String>;

    /// The id of a GraphQL source in the `SourceTable`, which is added to the
    /// table if it's not already there. Sources must be added before they're
    /// parsed, so that locations in the parsed document can refer to them.
    fn add_source(&self, name: &str, body: &str) -> u32;
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct File {
    /// The id of the file's source in the `SourceTable`.
    pub source: u32,
    pub path: String,
    pub text: String,
    /// Whether TypeScript considers the file a module, rather than a script
    /// whose declarations are global.
    pub is_module: bool,
}

/// A `Host` which calls a host that exchanges JSON: it's given a
/// `HostRequest` and answers with the method's result.
pub struct JsonHost<F: Fn(String) -> String> {
    call: F,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum HostRequest<'r> {
    SourceFile { source: u32 },
    ReadFile { path: &'r str },
    ResolveModule { from: &'r str, specifier: &'r str },
    GlobalFiles { name: &'r str },
    AddSource { name: &'r str, body: &'r str },
}

impl<F: Fn(String) -> String> JsonHost<F> {
    pub fn new(call: F) -> Self {
        JsonHost { call }
    }

    fn request<T: for<'de> Deserialize<'de>>(&self, request: HostRequest) -> T {
        let request = serde_json::to_string(&request).expect("Host requests should serialize");
        let response = (self.call)(request);
        serde_json::from_str(&response).expect("Host responses should be JSON")
    }
}

impl<F: Fn(String) -> String> Host for JsonHost<F> {
    fn source_file(&self, source: u32) -> File {
        self.request(HostRequest::SourceFile { source })
    }

    fn read_file(&self, path: &str) -> Option<File> {
        self.request(HostRequest::ReadFile { path })
    }

    fn resolve_module(&self, from: &str, specifier: &str) -> Option<String> {
        self.request(HostRequest::ResolveModule { from, specifier })
    }

    fn global_files(&self, name: &str) -> Vec<String> {
        self.request(HostRequest::GlobalFiles { name })
    }

    fn add_source(&self, name: &str, body: &str) -> u32 {
        self.request(HostRequest::AddSource { name, body })
    }
}
