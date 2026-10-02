//! What Grats asks of its host: access to the file system and the console.
//!
//! Paths are absolute and use `/` as their separator. On Windows, a path like
//! `C:\project` is given as `/C:/project` (see `crate::utils::path`).

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
#[derive(Debug)]
pub struct DirEntries {
    pub files: Vec<String>,
    pub directories: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum FileKind {
    File,
    Directory,
    Symlink,
}
