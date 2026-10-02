//! WebAssembly bindings for Grats, for the website's playground. See
//! `website/src/wasm/grats.ts`, which loads them.
//!
//! The playground's files are in memory, so rather than giving Grats access
//! to a file system, each call is given the files (see `MemoryHost`) and
//! returns everything the playground shows for them.
//!
//! Entry points take a string (usually JSON) and produce a string. We use a
//! small hand-written ABI rather than wasm-bindgen, so that the build only
//! needs `cargo`:
//!
//! 1. The loader calls `init` once after instantiating the module.
//! 2. To call an entry point, JS calls `alloc(len)` and writes the UTF-8 input
//!    into the returned buffer.
//! 3. JS calls the entry point with `(ptr, len)`. It takes ownership of the
//!    buffer and stores its result as the output.
//! 4. JS reads the output via `output_ptr()` and `output_len()`.
//!
//! Panics abort, which traps. The panic hook first stores the panic message
//! as the output so that JS can report it.

mod memory_host;

use std::cell::RefCell;
use std::collections::BTreeMap;
use std::sync::Arc;

use graphql_js::language::ast::Location;
use grats::grats_config::{ValidatedConfig, validate_grats_options};
use grats::print_schema::{OutputRequest, Outputs, print_outputs};
use grats::program::ProgramOptions;
use grats::source_table::SourceTable;
use grats::utils::diagnostic_error::{CodeFixAction, Diagnostic, locationless_err};
use grats::utils::format_diagnostics::format_diagnostic_with_context;
use grats::utils::path;
use serde::{Deserialize, Serialize};

use crate::memory_host::MemoryHost;

/// The directory of the playground's project: its `tsconfig.json`, which
/// the options' paths are relative to, and the current directory, which
/// diagnostics' paths are relative to.
const PROJECT_DIRECTORY: &str = "/";

thread_local! {
    static OUTPUT: RefCell<String> = const { RefCell::new(String::new()) };
}

#[unsafe(no_mangle)]
pub extern "C" fn init() {
    std::panic::set_hook(Box::new(|info| {
        OUTPUT.with(|output| {
            if let Ok(mut output) = output.try_borrow_mut() {
                *output = info.to_string();
            }
        })
    }));
}

#[unsafe(no_mangle)]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(len);
    let ptr = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    ptr
}

#[unsafe(no_mangle)]
pub extern "C" fn output_ptr() -> *const u8 {
    OUTPUT.with(|output| output.borrow().as_ptr())
}

#[unsafe(no_mangle)]
pub extern "C" fn output_len() -> usize {
    OUTPUT.with(|output| output.borrow().len())
}

fn set_output(value: String) {
    OUTPUT.with(|output| *output.borrow_mut() = value);
}

/// Runs an entry point's implementation on its input and stores the result.
///
/// # Safety
///
/// `ptr` and `len` must be a buffer returned by `alloc(len)`, filled with UTF-8.
unsafe fn call(ptr: *mut u8, len: usize, f: impl FnOnce(String) -> String) {
    // Don't leave a previous result behind if this call traps without a panic
    // message.
    set_output(String::new());
    let bytes = unsafe { Vec::from_raw_parts(ptr, len, len) };
    let input = String::from_utf8(bytes).expect("Input should be UTF-8");
    set_output(f(input));
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompileRequest {
    /// The text of each file of the project, by absolute path. Grats' types
    /// can be imported from `"grats"` if the package is among them, in
    /// `/node_modules/grats`.
    files: BTreeMap<String, String>,
    /// The files to extract GraphQL definitions from, along with the files
    /// they import.
    root_names: Vec<String>,
    /// The `grats` key of the project's `tsconfig.json`.
    config: serde_json::Value,
}

#[derive(Serialize)]
struct Compiled {
    /// The files which the CLI would write, as the config asks for them.
    outputs: Outputs,
    /// Warnings about the config.
    warnings: Vec<String>,
}

/// A diagnostic, with what an editor needs to show it.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReportedDiagnostic {
    message: String,
    /// The diagnostic as the CLI reports it, without color.
    formatted: String,
    location: Option<FileLocation>,
    related_information: Vec<RelatedInformation>,
    fix: Option<CodeFixAction>,
}

#[derive(Serialize)]
struct RelatedInformation {
    message: String,
    location: FileLocation,
}

/// A span of a file. Offsets are UTF-16, like JavaScript's.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileLocation {
    file_name: String,
    start: u32,
    length: u32,
}

/// Input: a `CompileRequest`, as JSON. Output: the `Compiled` project, or
/// its diagnostics (see `ReportedDiagnostic`), as a JSON `Result` (see
/// `src/utils/Result.ts`).
///
/// # Safety
///
/// See `call`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn compile(ptr: *mut u8, len: usize) {
    unsafe {
        call(ptr, len, |input| {
            let request: CompileRequest =
                serde_json::from_str(&input).expect("Input should be a CompileRequest");
            result_json(compile_project(request))
        })
    }
}

/// Like running the CLI on the project, keeping what it would write.
fn compile_project(request: CompileRequest) -> Result<Compiled, Vec<ReportedDiagnostic>> {
    let ValidatedConfig { config, warnings } = validate_grats_options(Some(&request.config))
        .map_err(|message| report(vec![locationless_err(message)], &SourceTable::default()))?;
    let program = ProgramOptions {
        root_names: request.root_names,
        allow_js: false,
        tsconfig: None,
        use_case_sensitive_file_names: true,
    };
    let host = Arc::new(MemoryHost::new(request.files));
    let sources = SourceTable::default();
    // Module paths are kept relative to the root, then printed relative to
    // the TypeScript schema, so any root will do.
    let grats_root = PROJECT_DIRECTORY;
    let doc = grats::pipeline::run(&config, grats_root, &program, host, &sources)
        .map_err(|diagnostics| report(diagnostics, &sources))?;
    let resolve = |relative: &str| path::resolve(PROJECT_DIRECTORY, relative);
    let outputs = print_outputs(
        &doc,
        OutputRequest {
            config: config.clone(),
            grats_root: grats_root.to_string(),
            graphql_schema: true,
            ts_schema: Some(resolve(&config.ts_schema)),
            ts_client_enums: config.ts_client_enums.as_deref().map(resolve),
            metadata: config.experimental_emit_metadata,
        },
    );
    Ok(Compiled { outputs, warnings })
}

fn report(diagnostics: Vec<Diagnostic>, sources: &SourceTable) -> Vec<ReportedDiagnostic> {
    let file_location = |loc: &Location| FileLocation {
        file_name: sources.get(loc.source).name.clone(),
        start: loc.start,
        length: loc.end - loc.start,
    };
    diagnostics
        .into_iter()
        .map(|diagnostic| ReportedDiagnostic {
            formatted: format_diagnostic_with_context(&diagnostic, sources, PROJECT_DIRECTORY),
            location: diagnostic.loc.as_ref().map(file_location),
            related_information: diagnostic
                .related_information
                .iter()
                .flatten()
                .map(|related| RelatedInformation {
                    message: related.message_text.clone(),
                    location: file_location(&related.loc),
                })
                .collect(),
            fix: diagnostic.fix.map(|fix| *fix),
            message: diagnostic.message_text,
        })
        .collect()
}

fn result_json<T: Serialize, E: Serialize>(result: Result<T, E>) -> String {
    let json = match result {
        Ok(value) => serde_json::json!({ "kind": "OK", "value": value }),
        Err(err) => serde_json::json!({ "kind": "ERROR", "err": err }),
    };
    json.to_string()
}
