//! PORT: No TypeScript counterpart. What the Rust port of Grats asks of its
//! host: access to the file system and the console. See `src/rs/host.ts`.
//!
//! Paths are absolute and use `/` as their separator. On Windows, a path like
//! `C:\project` is given as `/C:/project` (see `crate::utils::path`).

use serde::{Deserialize, Serialize};

/// Hosts are `Send` and `Sync` so that module resolution (see
/// `crate::program`) can read files through them.
pub trait Host: Send + Sync {
    /// The text of the file at `path`, or `None` if it can't be read.
    fn read_file(&self, path: &str) -> Option<String>;

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

    /// The current directory, which diagnostics' paths are relative to.
    fn current_directory(&self) -> String;

    /// Writes `contents` to the file at `path`, or returns why it couldn't.
    fn write_file(&self, path: &str, contents: &str) -> Result<(), String>;

    /// Prints a line to stdout, like `console.log`.
    fn log(&self, message: &str);

    /// Prints a line to stderr, like `console.error`.
    fn log_error(&self, message: &str);
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
    CurrentDirectory,
    WriteFile {
        path: &'r str,
        contents: &'r str,
    },
    Log {
        message: &'r str,
    },
    LogError {
        message: &'r str,
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

    fn current_directory(&self) -> String {
        self.request(HostRequest::CurrentDirectory)
    }

    fn write_file(&self, path: &str, contents: &str) -> Result<(), String> {
        // The host answers with an error message if it couldn't.
        let error: Option<String> = self.request(HostRequest::WriteFile { path, contents });
        error.map_or(Ok(()), Err)
    }

    fn log(&self, message: &str) {
        self.request::<()>(HostRequest::Log { message })
    }

    fn log_error(&self, message: &str) {
        self.request::<()>(HostRequest::LogError { message })
    }
}
