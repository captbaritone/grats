//! The subset of Node's `path` module Grats uses.
//!
//! Node's `path` follows the conventions of the platform it runs on. Wasm has
//! no platform, so this follows POSIX conventions everywhere, as Node does
//! outside of Windows (and as the playground's `path-browserify` does). This
//! works on strings rather than `std::path`, which considers no path absolute
//! on `wasm32-unknown-unknown`. To support Windows:
//!
//! - Backslashes are treated as separators, like `path.win32` does. On other
//!   platforms Node would treat them as part of a file name.
//! - Hosts give absolute paths, and paths are resolved against `/`
//!   rather than a working directory. POSIX rules consider a Windows path like
//!   `C:/project` relative, so it resolves to `/C:/project`, which keeps the
//!   drive as the first component. Relative paths between two paths on the
//!   same drive then come out the same as with `path.win32`.
//!
//! Unlike `path.win32`, paths are compared case-sensitively, and a relative
//! path between two drives is not an absolute path to the target.

/// The directory that paths are resolved against. See the module comment.
const CWD: &str = "/";

/// Like `path.resolve(from, to)`. Since paths are resolved against `/`, the
/// result is always absolute.
pub fn resolve(from: &str, to: &str) -> String {
    let paths = [CWD, from, to].map(to_posix);
    // Paths before the last absolute one don't affect the result.
    let start = paths
        .iter()
        .rposition(|path| path.starts_with('/'))
        .expect("CWD is absolute");
    let mut segments = Vec::new();
    for segment in paths[start..].iter().flat_map(|path| path.split('/')) {
        match segment {
            "" | "." => {}
            ".." => {
                segments.pop();
            }
            _ => segments.push(segment),
        }
    }
    format!("/{}", segments.join("/"))
}

/// Like `path.relative(from, to)`.
pub fn relative(from: &str, to: &str) -> String {
    let from = resolve(CWD, from);
    let to = resolve(CWD, to);
    let mut from_segments = segments(&from).peekable();
    let mut to_segments = segments(&to).peekable();
    while from_segments.peek().is_some() && from_segments.peek() == to_segments.peek() {
        from_segments.next();
        to_segments.next();
    }
    from_segments
        .map(|_| "..")
        .chain(to_segments)
        .collect::<Vec<_>>()
        .join("/")
}

/// The segments of a resolved path.
fn segments(resolved: &str) -> impl Iterator<Item = &str> {
    resolved.split('/').filter(|segment| !segment.is_empty())
}

/// A path as the platform writes it, for showing to users: on Windows,
/// `/C:/project` is `C:/project`.
pub fn to_native(path: &str) -> &str {
    match path.strip_prefix('/') {
        Some(rest) if starts_with_drive(rest) => rest,
        _ => path,
    }
}

/// A path for `std::path`, such as one to give `oxc_resolver`. On Windows,
/// `/C:/project` is `C:/project`, which `std::path` considers absolute.
pub fn to_std(path: &str) -> std::path::PathBuf {
    if cfg!(windows) {
        to_native(path).into()
    } else {
        path.into()
    }
}

/// A path from `std::path`, such as one `oxc_resolver` built from paths
/// `to_std` gave it. On Windows, `std::path` joins components with `\`, so
/// `C:/project` and `src` come back as `C:/project\src`, which is
/// `/C:/project/src`.
pub fn from_std(path: &std::path::Path) -> String {
    let path = path.to_string_lossy();
    if !cfg!(windows) {
        return path.into_owned();
    }
    let slashed = to_posix(&path);
    if starts_with_drive(&slashed) {
        format!("/{slashed}")
    } else {
        slashed
    }
}

/// A path as Rust is given it, from one the user wrote, which may be relative
/// to `current_directory`: with `/` as its separator, and on Windows,
/// `C:\project` is `/C:/project`.
pub fn from_native(current_directory: &str, path: &str) -> String {
    if starts_with_drive(path) {
        resolve(current_directory, &format!("/{path}"))
    } else {
        resolve(current_directory, path)
    }
}

/// Whether `path` starts with a Windows drive, like `C:`.
fn starts_with_drive(path: &str) -> bool {
    matches!(path.as_bytes(), [letter, b':', ..] if letter.is_ascii_alphabetic())
}

/// Like `path.dirname(path)`, with backslashes treated as separators.
pub fn dirname(path: &str) -> &str {
    if path.is_empty() {
        return ".";
    }
    // Node's `posix.dirname` never treats a leading separator as the end of
    // the directory, so `//a` is in `//`.
    let root_len = usize::from(path.starts_with(is_separator));
    let rest = path[root_len..].trim_end_matches(is_separator);
    match rest.rfind(is_separator) {
        Some(0) if root_len == 1 => "//",
        Some(end) => &path[..root_len + end],
        None if root_len == 1 => "/",
        None => ".",
    }
}

/// Like `path.extname(path)`, with backslashes treated as separators.
pub fn extname(path: &str) -> &str {
    let base = path
        .trim_end_matches(is_separator)
        .rsplit(is_separator)
        .next()
        .unwrap_or_default();
    match base.rfind('.') {
        // A name whose only dot is its first character, like `.file`, has no
        // extension.
        Some(dot) if dot > 0 && base != ".." => &base[dot..],
        _ => "",
    }
}

fn is_separator(c: char) -> bool {
    c == '/' || c == '\\'
}

fn to_posix(path: &str) -> String {
    path.replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;

    // Cases from Node's `test/parallel/test-path-resolve.js` and
    // `test-path-relative.js` (posix), limited to absolute paths.
    #[test]
    fn resolve_matches_node() {
        for (from, to, expected) in [
            ("/var/lib", "../", "/var"),
            ("/var/lib", "/../", "/"),
            ("/some/dir", ".", "/some/dir"),
            (
                "/foo/tmp.3/",
                "../tmp.3/cycles/root.js",
                "/foo/tmp.3/cycles/root.js",
            ),
            ("/var/lib", "./file.ts", "/var/lib/file.ts"),
            ("/var/lib", "/etc/file.ts", "/etc/file.ts"),
            ("/a/b/c", "../../x/y.ts", "/a/x/y.ts"),
            ("/", "a//b/../c/./d.ts", "/a/c/d.ts"),
            ("/a", "../../../b", "/b"),
            ("/a/b/", "c/", "/a/b/c"),
            ("/a/..b", "./..c/.d", "/a/..b/..c/.d"),
            ("/a", "", "/a"),
        ] {
            assert_eq!(resolve(from, to), expected, "resolve({from:?}, {to:?})");
        }
    }

    #[test]
    fn relative_matches_node() {
        for (from, to, expected) in [
            ("/var/lib", "/var", ".."),
            ("/var/lib", "/bin", "../../bin"),
            ("/var/lib", "/var/lib", ""),
            ("/var/lib", "/var/apache", "../apache"),
            ("/var/", "/var/lib", "lib"),
            ("/", "/var/lib", "var/lib"),
            (
                "/foo/test",
                "/foo/test/bar/package.json",
                "bar/package.json",
            ),
            ("/Users/a/web/b/test/mails", "/Users/a/web/b", "../.."),
            ("/foo/bar/baz-quux", "/foo/bar/baz", "../baz"),
            ("/foo/bar/baz", "/foo/bar/baz-quux", "../baz-quux"),
            ("/baz-quux", "/baz", "../baz"),
            ("/baz", "/baz-quux", "../baz-quux"),
            ("/page1/page2/foo", "/", "../../.."),
            ("/a/b", "/a/b/", ""),
            ("/a/b/c", "/a/d", "../../d"),
        ] {
            assert_eq!(relative(from, to), expected, "relative({from:?}, {to:?})");
        }
    }

    #[test]
    fn windows_paths_on_the_same_drive() {
        let abs = resolve(r"C:\Users\me\grats", r"..\project\src\index.ts");
        assert_eq!(abs, "/C:/Users/me/project/src/index.ts");
        assert_eq!(
            relative(dirname("C:/Users/me/project/schema.ts"), &abs),
            "src/index.ts"
        );
        assert_eq!(
            relative(r"C:\Users\me\project\out", &abs),
            "../src/index.ts"
        );
    }

    // Cases from Node's `test/parallel/test-path-dirname.js` (posix).
    #[test]
    fn dirname_matches_node() {
        for (path, expected) in [
            ("/a/b/", "/a"),
            ("/a/b", "/a"),
            ("/a", "/"),
            ("", "."),
            ("/", "/"),
            ("////", "/"),
            ("//a", "//"),
            ("foo", "."),
            ("/a//b", "/a/"),
            ("a//b", "a/"),
            ("a/", "."),
        ] {
            assert_eq!(dirname(path), expected, "dirname({path:?})");
        }
    }

    // Cases from Node's `test/parallel/test-path-extname.js`.
    #[test]
    fn extname_matches_node() {
        for (path, expected) in [
            ("", ""),
            ("/path/to/file", ""),
            ("/path/to/file.ext", ".ext"),
            ("/path.to/file.ext", ".ext"),
            ("/path.to/file", ""),
            ("/path.to/.file", ""),
            ("/path.to/.file.ext", ".ext"),
            ("/path/to/f.ext", ".ext"),
            ("/path/to/..ext", ".ext"),
            ("/path/to/..", ""),
            ("file", ""),
            ("file.ext", ".ext"),
            (".file", ""),
            (".file.ext", ".ext"),
            ("/file", ""),
            ("/file.ext", ".ext"),
            ("/.file", ""),
            ("/.file.ext", ".ext"),
            (".path/file.ext", ".ext"),
            ("file.ext.ext", ".ext"),
            ("file.", "."),
            (".", ""),
            ("./", ""),
            (".file.ext", ".ext"),
            (".file", ""),
            (".file.", "."),
            (".file..", "."),
            ("..", ""),
            ("../", ""),
            ("..file.ext", ".ext"),
            ("..file", ".file"),
            ("..file.", "."),
            ("..file..", "."),
            ("...", "."),
            ("...ext", ".ext"),
            ("....", "."),
            ("file.ext/", ".ext"),
            ("file.ext//", ".ext"),
            ("file/", ""),
            ("file//", ""),
            ("file./", "."),
            ("file.//", "."),
            ("index.d.ts", ".ts"),
        ] {
            assert_eq!(extname(path), expected, "extname({path:?})");
        }
    }
}
