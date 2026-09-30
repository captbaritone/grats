//! PORT: No TypeScript counterpart. What the Rust port of Grats asks of its
//! host: access to the file system, and the `SourceTable` which locations in
//! its output refer to. See `src/rs/host.ts`.
//!
//! Paths are absolute and use `/` as their separator. On Windows, a path like
//! `C:\project` is given as `/C:/project` (see `crate::utils::path`).

use serde::{Deserialize, Serialize};

/// Hosts are `Send` and `Sync` so that module resolution (see
/// `crate::program`) can read files through them.
pub trait Host: Send + Sync {
    /// The text of the file at `path`, or `None` if it can't be read.
    fn read_file(&self, path: &str) -> Option<String>;

    /// A file of the program, whose source is added to the `SourceTable` if
    /// it's not already there. `None` if it can't be read.
    fn read_source_file(&self, path: &str) -> Option<SourceFile>;

    /// What kind of entry is at `path`, if any. Symbolic links are followed
    /// if `follow_links`.
    fn stat(&self, path: &str, follow_links: bool) -> Option<FileKind>;

    /// The target of the symbolic link at `path`, as an absolute path.
    fn read_link(&self, path: &str) -> Option<String>;

    /// `path` with every symbolic link in it resolved.
    fn realpath(&self, path: &str) -> Option<String>;

    /// The names of the entries of the directory at `path`, following
    /// symbolic links, or `None` if it can't be read.
    fn read_dir(&self, path: &str) -> Option<DirEntries>;

    /// The id of a GraphQL source in the `SourceTable`, which is added to the
    /// table if it's not already there. Sources must be added before they're
    /// parsed, so that locations in the parsed document can refer to them.
    fn add_source(&self, name: &str, body: &str) -> u32;
}

#[derive(Debug, Deserialize)]
pub struct SourceFile {
    /// The id of the file's source in the `SourceTable`.
    pub source: u32,
    pub text: String,
}

/// The entries of a directory, by name, each sorted.
#[derive(Debug, Deserialize)]
pub struct DirEntries {
    pub files: Vec<String>,
    pub directories: Vec<String>,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FileKind {
    File,
    Directory,
    Symlink,
}

/// A `Host` which calls a host that exchanges JSON: it's given a
/// `HostRequest` and answers with the method's result.
pub struct JsonHost<F: Fn(String) -> String> {
    call: F,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum HostRequest<'r> {
    ReadFile {
        path: &'r str,
    },
    ReadSourceFile {
        path: &'r str,
    },
    #[serde(rename_all = "camelCase")]
    Stat {
        path: &'r str,
        follow_links: bool,
    },
    ReadLink {
        path: &'r str,
    },
    Realpath {
        path: &'r str,
    },
    ReadDir {
        path: &'r str,
    },
    AddSource {
        name: &'r str,
        body: &'r str,
    },
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

impl<F: Fn(String) -> String + Send + Sync> Host for JsonHost<F> {
    fn read_file(&self, path: &str) -> Option<String> {
        self.request(HostRequest::ReadFile { path })
    }

    fn read_source_file(&self, path: &str) -> Option<SourceFile> {
        self.request(HostRequest::ReadSourceFile { path })
    }

    fn stat(&self, path: &str, follow_links: bool) -> Option<FileKind> {
        self.request(HostRequest::Stat { path, follow_links })
    }

    fn read_link(&self, path: &str) -> Option<String> {
        self.request(HostRequest::ReadLink { path })
    }

    fn realpath(&self, path: &str) -> Option<String> {
        self.request(HostRequest::Realpath { path })
    }

    fn read_dir(&self, path: &str) -> Option<DirEntries> {
        self.request(HostRequest::ReadDir { path })
    }

    fn add_source(&self, name: &str, body: &str) -> u32 {
        self.request(HostRequest::AddSource { name, body })
    }
}
