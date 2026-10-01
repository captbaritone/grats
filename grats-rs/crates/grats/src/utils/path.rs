//! The subset of Node's `path` module used by Grats, ported from Node's
//! `lib/path.js`.
//!
//! PORT: Node's `path` follows the conventions of the platform it runs on.
//! Wasm has no platform, so this follows POSIX conventions everywhere, as Node
//! does outside of Windows (and as the playground's `path-browserify` does).
//! This works on strings rather than `std::path`, which considers no path
//! absolute on `wasm32-unknown-unknown`. To support Windows:
//!
//! - Backslashes are treated as separators, like `path.win32` does. On other
//!   platforms Node would treat them as part of a file name.
//! - TypeScript passes absolute paths, and paths are resolved against `/`
//!   rather than a working directory. POSIX rules consider a Windows path like
//!   `C:/project` relative, so it resolves to `/C:/project`, which keeps the
//!   drive as the first component. Relative paths between two paths on the
//!   same drive then come out the same as with `path.win32`.
//!
//! Unlike `path.win32`, paths are compared case-sensitively, and a relative
//! path between two drives is not an absolute path to the target.

/// The directory that paths are resolved against. See the module comment.
const CWD: &str = "/";

/// Like `path.resolve(from, to)`.
pub fn resolve(from: &str, to: &str) -> String {
    let mut resolved_path = String::new();
    let mut resolved_absolute = false;
    for path in [to, from, CWD] {
        if resolved_absolute {
            break;
        }
        // Skip empty entries
        if path.is_empty() {
            continue;
        }
        let path = to_posix(path);
        resolved_absolute = path.starts_with('/');
        resolved_path = format!("{path}/{resolved_path}");
    }

    // Normalize the path
    let resolved_path = normalize_string(&resolved_path, !resolved_absolute);

    if resolved_absolute {
        return format!("/{resolved_path}");
    }
    if resolved_path.is_empty() {
        ".".to_string()
    } else {
        resolved_path
    }
}

/// Like `path.relative(from, to)`.
pub fn relative(from: &str, to: &str) -> String {
    if from == to {
        return String::new();
    }

    // Trim leading forward slashes.
    let from = resolve(CWD, from);
    let to = resolve(CWD, to);

    if from == to {
        return String::new();
    }

    let from = from.as_bytes();
    let to = to.as_bytes();
    let from_start = 1;
    let from_end = from.len();
    let from_len = from_end - from_start;
    let to_start = 1;
    let to_len = to.len() - to_start;

    // Compare paths to find the longest common path from root
    let length = from_len.min(to_len);
    let mut last_common_sep = None;
    let mut i = 0;
    while i < length {
        let from_code = from[from_start + i];
        if from_code != to[to_start + i] {
            break;
        } else if from_code == b'/' {
            last_common_sep = Some(i);
        }
        i += 1;
    }
    if i == length {
        if to_len > length {
            if to[to_start + i] == b'/' {
                // We get here if `from` is the exact base path for `to`.
                // For example: from='/foo/bar'; to='/foo/bar/baz'
                return slice(to, to_start + i + 1);
            }
            if i == 0 {
                // We get here if `from` is the root
                // For example: from='/'; to='/foo'
                return slice(to, to_start + i);
            }
        } else if from_len > length {
            if from[from_start + i] == b'/' {
                // We get here if `to` is the exact base path for `from`.
                // For example: from='/foo/bar/baz'; to='/foo/bar'
                last_common_sep = Some(i);
            } else if i == 0 {
                // We get here if `to` is the root.
                // For example: from='/foo/bar'; to='/'
                last_common_sep = Some(0);
            }
        }
    }

    // PORT: Node uses -1 for no common separator. These are the indexes just
    // past it in `from` and at it in `to`.
    let (from_rest, to_rest) = match last_common_sep {
        Some(sep) => (from_start + sep + 1, to_start + sep),
        None => (from_start, to_start - 1),
    };

    let mut out = String::new();
    // Generate the relative path based on the path difference between `to`
    // and `from`.
    // PORT: Node loops over indexes up to and including `fromEnd`, which
    // counts as a separator.
    for &code in from[from_rest..].iter().chain([&b'/']) {
        if code == b'/' {
            out.push_str(if out.is_empty() { ".." } else { "/.." });
        }
    }

    // Lastly, append the rest of the destination (`to`) path that comes after
    // the common path parts.
    out + &slice(to, to_rest)
}

/// A path as the platform writes it, for showing to users: on Windows,
/// `/C:/project` is `C:/project`. Like `fromRustPath` in `src/rs/host.ts`.
pub fn to_native(path: &str) -> &str {
    let bytes = path.as_bytes();
    if bytes.len() >= 3 && bytes[0] == b'/' && bytes[1].is_ascii_alphabetic() && bytes[2] == b':' {
        &path[1..]
    } else {
        path
    }
}

/// A path as Rust is given it, from one the user wrote, which may be relative
/// to `current_directory`: with `/` as its separator, and on Windows,
/// `C:\project` is `/C:/project`. Like `toRustPath` in `src/rs/host.ts`.
pub fn from_native(current_directory: &str, path: &str) -> String {
    let bytes = path.as_bytes();
    if bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
        resolve(current_directory, &format!("/{path}"))
    } else {
        resolve(current_directory, path)
    }
}

/// Like `path.dirname(path)`.
///
/// Ported from Node's `lib/path.js` (`posix.dirname`), with backslashes
/// treated as separators.
pub fn dirname(path: &str) -> &str {
    if path.is_empty() {
        return ".";
    }
    let bytes = path.as_bytes();
    let has_root = is_separator(bytes[0]);
    let mut end = None;
    let mut matched_slash = true;
    for i in (1..bytes.len()).rev() {
        if is_separator(bytes[i]) {
            if !matched_slash {
                end = Some(i);
                break;
            }
        } else {
            // We saw the first non-path separator
            matched_slash = false;
        }
    }

    match end {
        None => {
            if has_root {
                "/"
            } else {
                "."
            }
        }
        Some(1) if has_root => "//",
        Some(end) => &path[..end],
    }
}

/// Like `path.extname(path)`.
///
/// Ported from Node's `lib/path.js` (`posix.extname`), with backslashes
/// treated as separators.
pub fn extname(path: &str) -> &str {
    let bytes = path.as_bytes();
    let mut start_dot = None;
    let mut start_part = 0;
    let mut end = None;
    let mut matched_slash = true;
    // Track the state of characters (if any) we see before our first dot and
    // after any path separator we find
    let mut pre_dot_state = 0;
    for i in (0..bytes.len()).rev() {
        let code = bytes[i];
        if is_separator(code) {
            // If we reached a path separator that was not part of a set of path
            // separators at the end of the string, stop now
            if !matched_slash {
                start_part = i + 1;
                break;
            }
            continue;
        }
        if end.is_none() {
            // We saw the first non-path separator, mark this as the end of our
            // extension
            matched_slash = false;
            end = Some(i + 1);
        }
        if code == b'.' {
            // If this is our first dot, mark it as the start of our extension
            if start_dot.is_none() {
                start_dot = Some(i);
            } else if pre_dot_state != 1 {
                pre_dot_state = 1;
            }
        } else if start_dot.is_some() {
            // We saw a non-dot and non-path separator before our dot, so we should
            // have a good chance at having a non-empty extension
            pre_dot_state = -1;
        }
    }

    match (start_dot, end) {
        (Some(start_dot), Some(end))
            // We saw a non-dot character immediately before the dot
            if pre_dot_state != 0
                // The (right-most) trimmed path component is exactly '..'
                && !(pre_dot_state == 1 && start_dot == end - 1 && start_dot == start_part + 1) =>
        {
            &path[start_dot..end]
        }
        _ => "",
    }
}

fn is_separator(code: u8) -> bool {
    code == b'/' || code == b'\\'
}

/// Resolves . and .. elements in a path with directory names
///
/// PORT: Node's version takes the separator to support Windows. This is the
/// POSIX version, run on paths whose backslashes are already slashes.
fn normalize_string(path: &str, allow_above_root: bool) -> String {
    let bytes = path.as_bytes();
    let mut res = String::new();
    let mut last_segment_length = 0;
    // PORT: Node starts `lastSlash` at -1. This is one past it.
    let mut segment_start = 0;
    let mut dots = Some(0);
    let mut code = 0;
    for i in 0..=bytes.len() {
        if i < bytes.len() {
            code = bytes[i];
        } else if code == b'/' {
            break;
        } else {
            code = b'/';
        }

        if code == b'/' {
            if segment_start == i || dots == Some(1) {
                // NOOP
            } else if dots == Some(2) {
                if res.len() < 2 || last_segment_length != 2 || !res.ends_with("..") {
                    if res.len() > 2 {
                        match res.rfind('/') {
                            None => {
                                res.clear();
                                last_segment_length = 0;
                            }
                            Some(last_slash_index) => {
                                res.truncate(last_slash_index);
                                last_segment_length = match res.rfind('/') {
                                    Some(last_slash_index) => res.len() - 1 - last_slash_index,
                                    None => res.len(),
                                };
                            }
                        }
                        segment_start = i + 1;
                        dots = Some(0);
                        continue;
                    } else if !res.is_empty() {
                        res.clear();
                        last_segment_length = 0;
                        segment_start = i + 1;
                        dots = Some(0);
                        continue;
                    }
                }
                if allow_above_root {
                    res.push_str(if res.is_empty() { ".." } else { "/.." });
                    last_segment_length = 2;
                }
            } else {
                if !res.is_empty() {
                    res.push('/');
                }
                res.push_str(&path[segment_start..i]);
                last_segment_length = i - segment_start;
            }
            segment_start = i + 1;
            dots = Some(0);
        } else if code == b'.' && dots.is_some() {
            dots = dots.map(|dots| dots + 1);
        } else {
            dots = None;
        }
    }
    res
}

fn to_posix(path: &str) -> String {
    path.replace('\\', "/")
}

/// PORT: Slices at a separator, so the slice is at a character boundary.
fn slice(path: &[u8], start: usize) -> String {
    String::from_utf8_lossy(&path[start..]).into_owned()
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
