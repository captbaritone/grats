//! A `Host` whose file system is a set of files held in memory, like the
//! playground's editors. Directories are implied by the files' paths, and
//! there are no symbolic links.

use std::collections::{BTreeMap, BTreeSet};

use grats::host::{DirEntries, FileKind, Host};

pub struct MemoryHost {
    /// The text of each file, by absolute path.
    files: BTreeMap<String, String>,
}

impl MemoryHost {
    pub fn new(files: BTreeMap<String, String>) -> Self {
        MemoryHost { files }
    }

    /// The paths of the files within the directory at `path`, relative to it.
    fn descendants<'h>(&'h self, path: &str) -> impl Iterator<Item = &'h str> {
        let prefix = if path.ends_with('/') {
            path.to_string()
        } else {
            format!("{path}/")
        };
        self.files
            .range(prefix.clone()..)
            .map_while(move |(file, _)| file.strip_prefix(&prefix))
    }

    fn is_directory(&self, path: &str) -> bool {
        self.descendants(path).next().is_some()
    }
}

impl Host for MemoryHost {
    fn read_file(&self, path: &str) -> Option<String> {
        self.files.get(path).cloned()
    }

    fn stat(&self, path: &str, _follow_links: bool) -> Option<FileKind> {
        if self.files.contains_key(path) {
            Some(FileKind::File)
        } else if self.is_directory(path) {
            Some(FileKind::Directory)
        } else {
            None
        }
    }

    fn read_link(&self, _path: &str) -> Option<String> {
        None
    }

    fn realpath(&self, path: &str) -> Option<String> {
        self.stat(path, true).map(|_| path.to_string())
    }

    fn read_dir(&self, path: &str) -> Option<DirEntries> {
        let mut files = BTreeSet::new();
        let mut directories = BTreeSet::new();
        for descendant in self.descendants(path) {
            match descendant.split_once('/') {
                Some((directory, _)) => directories.insert(directory.to_string()),
                None => files.insert(descendant.to_string()),
            };
        }
        if files.is_empty() && directories.is_empty() {
            return None;
        }
        Some(DirEntries {
            files: files.into_iter().collect(),
            directories: directories.into_iter().collect(),
        })
    }

    fn current_directory(&self) -> String {
        "/".to_string()
    }

    fn write_file(&self, _path: &str, _contents: &str) -> Result<(), String> {
        unreachable!("Compiling doesn't write files")
    }

    fn log(&self, _message: &str) {
        unreachable!("Compiling doesn't log")
    }

    fn log_error(&self, _message: &str) {
        unreachable!("Compiling doesn't log")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn host() -> MemoryHost {
        let paths = [
            "/index.ts",
            "/node_modules/grats/package.json",
            "/node_modules/grats/src/Types.ts",
            "/node_modules/grats-other.ts",
        ];
        MemoryHost::new(
            paths
                .into_iter()
                .map(|path| (path.to_string(), String::new()))
                .collect(),
        )
    }

    #[test]
    fn stat() {
        let host = host();
        assert_eq!(host.stat("/index.ts", true), Some(FileKind::File));
        assert_eq!(host.stat("/", true), Some(FileKind::Directory));
        assert_eq!(
            host.stat("/node_modules/grats", true),
            Some(FileKind::Directory)
        );
        assert_eq!(host.stat("/node_modules/grat", true), None);
        assert_eq!(host.stat("/missing.ts", true), None);
    }

    #[test]
    fn read_dir() {
        let host = host();
        let root = host.read_dir("/").expect("Expected the root directory");
        assert_eq!(root.files, ["index.ts"]);
        assert_eq!(root.directories, ["node_modules"]);
        let grats = host
            .read_dir("/node_modules/grats")
            .expect("Expected the package's directory");
        assert_eq!(grats.files, ["package.json"]);
        assert_eq!(grats.directories, ["src"]);
        assert!(host.read_dir("/index.ts").is_none());
    }
}
