//! A `Host` backed by the file system and the console.
//!
//! Grats' paths are absolute and use `/` as their separator, and on Windows
//! `C:\project` is `/C:/project` (see `grats::host`). Paths are converted to
//! and from the platform's at this boundary.

use std::cmp::Ordering;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use grats::host::{DirEntries, FileKind, Host};
use grats::utils::path;

pub struct NativeHost;

impl Host for NativeHost {
    fn read_file(&self, path: &str) -> Option<String> {
        fs::read(from_grats_path(path)).ok().map(decode)
    }

    /// Reads the files on several threads. Reading is mostly waiting on the
    /// file system, so there are more threads than cores.
    fn read_files(&self, paths: &[String]) -> Vec<Option<String>> {
        let threads = std::thread::available_parallelism().map_or(1, |cores| cores.get() * 2);
        let chunk_size = paths.len().div_ceil(threads).max(1);
        std::thread::scope(|scope| {
            let chunks: Vec<_> = paths
                .chunks(chunk_size)
                .map(|chunk| {
                    scope.spawn(|| {
                        chunk
                            .iter()
                            .map(|path| self.read_file(path))
                            .collect::<Vec<_>>()
                    })
                })
                .collect();
            chunks
                .into_iter()
                .flat_map(|chunk| chunk.join().expect("Reading files shouldn't panic"))
                .collect()
        })
    }

    fn stat(&self, path: &str, follow_links: bool) -> Option<FileKind> {
        let path = from_grats_path(path);
        let metadata = if follow_links {
            fs::metadata(path)
        } else {
            fs::symlink_metadata(path)
        };
        let file_type = metadata.ok()?.file_type();
        if file_type.is_symlink() {
            Some(FileKind::Symlink)
        } else if file_type.is_file() {
            Some(FileKind::File)
        } else if file_type.is_dir() {
            Some(FileKind::Directory)
        } else {
            None
        }
    }

    fn read_link(&self, path: &str) -> Option<String> {
        let target = fs::read_link(from_grats_path(path)).ok()?;
        let target = to_grats_path(&target);
        Some(path::resolve(path::dirname(path), &target))
    }

    fn realpath(&self, path: &str) -> Option<String> {
        let real = fs::canonicalize(from_grats_path(path)).ok()?;
        Some(to_grats_path(&real))
    }

    fn read_dir(&self, path: &str) -> Option<DirEntries> {
        let dir = from_grats_path(path);
        let mut files = Vec::new();
        let mut directories = Vec::new();
        for entry in fs::read_dir(&dir).ok()? {
            let Ok(entry) = entry else { continue };
            let Ok(mut file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_symlink() {
                match fs::metadata(entry.path()) {
                    Ok(metadata) => file_type = metadata.file_type(),
                    Err(_) => continue,
                }
            }
            let name = entry.file_name().to_string_lossy().into_owned();
            if file_type.is_file() {
                files.push(name);
            } else if file_type.is_dir() {
                directories.push(name);
            }
        }
        files.sort_by(|a, b| js_compare(a, b));
        directories.sort_by(|a, b| js_compare(a, b));
        Some(DirEntries { files, directories })
    }

    fn current_directory(&self) -> String {
        let current_directory =
            std::env::current_dir().expect("Expected the current directory to be readable");
        to_grats_path(&current_directory)
    }

    fn write_file(&self, path: &str, contents: &str) -> Result<(), String> {
        fs::write(from_grats_path(path), contents).map_err(|error| error.to_string())
    }

    fn log(&self, message: &str) {
        // Output that can't be written, e.g. to a closed pipe, is dropped.
        let _ = writeln!(std::io::stdout(), "{message}");
    }

    fn log_error(&self, message: &str) {
        let _ = writeln!(std::io::stderr(), "{message}");
    }
}

/// The root which Grats' module paths are relative to: the root of the
/// `grats` package, since this executable is `bin/<platform>/grats` (see
/// `bin/binaryPath.js`).
pub fn grats_root() -> String {
    let exe = std::env::current_exe().expect("Expected the executable's path to be known");
    let exe = fs::canonicalize(&exe).unwrap_or(exe);
    path::resolve(path::dirname(&to_grats_path(&exe)), "../..")
}

/// Like TypeScript's `ts.sys.useCaseSensitiveFileNames`: whether this
/// executable's path with its case swapped names no file.
pub fn use_case_sensitive_file_names() -> bool {
    if cfg!(windows) {
        return false;
    }
    let Ok(exe) = std::env::current_exe() else {
        return true;
    };
    let swapped: String = exe
        .to_string_lossy()
        .chars()
        .map(|c| {
            if c.is_uppercase() {
                c.to_lowercase().next().unwrap_or(c)
            } else {
                c.to_uppercase().next().unwrap_or(c)
            }
        })
        .collect();
    !Path::new(&swapped).exists()
}

/// Like `ts.sys.readFile`: text with a byte order mark is decoded as its
/// encoding, without the mark, and other text as UTF-8.
fn decode(bytes: Vec<u8>) -> String {
    let utf16 = |bytes: &[u8], from_bytes: fn([u8; 2]) -> u16| {
        let units: Vec<u16> = bytes
            .as_chunks::<2>()
            .0
            .iter()
            .copied()
            .map(from_bytes)
            .collect();
        String::from_utf16_lossy(&units)
    };
    match bytes.as_slice() {
        [0xFE, 0xFF, rest @ ..] => utf16(rest, u16::from_be_bytes),
        [0xFF, 0xFE, rest @ ..] => utf16(rest, u16::from_le_bytes),
        [0xEF, 0xBB, 0xBF, rest @ ..] => String::from_utf8_lossy(rest).into_owned(),
        _ => String::from_utf8(bytes)
            .unwrap_or_else(|error| String::from_utf8_lossy(error.as_bytes()).into_owned()),
    }
}

/// Compares like JavaScript's default sort, by UTF-16 code units.
fn js_compare(a: &str, b: &str) -> Ordering {
    a.encode_utf16().cmp(b.encode_utf16())
}

/// The Grats path of an absolute native path.
pub fn to_grats_path(native: &Path) -> String {
    let native = native.to_string_lossy();
    // `canonicalize` gives Windows paths in their verbatim form.
    let native = native
        .strip_prefix(r"\\?\UNC\")
        .map(|unc| format!(r"\\{unc}"))
        .unwrap_or_else(|| native.strip_prefix(r"\\?\").unwrap_or(&native).to_string());
    let slashed = native.replace('\\', "/");
    let bytes = slashed.as_bytes();
    if bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
        format!("/{slashed}")
    } else {
        slashed
    }
}

/// The native path of a Grats path.
pub fn from_grats_path(path: &str) -> PathBuf {
    PathBuf::from(path::to_native(path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_files_reads_each_file_in_order() {
        let dir = std::env::temp_dir().join(format!("grats-read-files-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let paths: Vec<String> = (0..50)
            .map(|index| {
                let native = dir.join(format!("file{index}.ts"));
                // Every third file is missing.
                if index % 3 != 0 {
                    fs::write(&native, format!("// {index}")).unwrap();
                }
                to_grats_path(&native)
            })
            .collect();
        let texts = NativeHost.read_files(&paths);
        fs::remove_dir_all(&dir).unwrap();
        let expected: Vec<Option<String>> = (0..50)
            .map(|index| (index % 3 != 0).then(|| format!("// {index}")))
            .collect();
        assert_eq!(texts, expected);
    }
}
