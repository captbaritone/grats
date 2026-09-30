//! Port of `src/gratsRoot.ts`.
//!
//! PORT: The TypeScript implementation finds the root from its own module's
//! location, which wasm doesn't have. Instead, TypeScript passes the absolute
//! root along with the ported code's input, and it's passed as an argument.

use crate::utils::path;

pub fn relative_path(grats_root: &str, absolute: &str) -> String {
    path::relative(grats_root, absolute)
}

pub fn resolve_relative_path(grats_root: &str, relative_path: &str) -> String {
    path::resolve(grats_root, relative_path)
}
