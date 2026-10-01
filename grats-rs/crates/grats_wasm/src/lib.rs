//! WebAssembly bindings for the Rust port of Grats, for the website's
//! playground. Nothing loads them yet: Grats' JS API, whose `src/rs/load.ts`
//! loaded them, was removed.
//!
//! Every entry point takes a string (usually JSON) and produces a string. We
//! use a small hand-written ABI rather than wasm-bindgen, so that the build
//! only needs `cargo`:
//!
//! 1. The loader calls `init` once after instantiating the module.
//! 2. To call an entry point, JS calls `alloc(len)` and writes the UTF-8 input
//!    into the returned buffer.
//! 3. JS calls the entry point with `(ptr, len)`. It takes ownership of the
//!    buffer and stores its result as the output.
//! 4. JS reads the output via `output_ptr()` and `output_len()`.
//!
//! While an entry point runs, Rust may call the host through the imported
//! `grats.host_call(ptr, len, out_ptr)`, with a request as JSON (see
//! `grats::host`). JS writes the response into a buffer from `alloc`, stores
//! its address at `out_ptr` and returns its length. Rust takes ownership of
//! the buffer.
//!
//! Panics abort, which traps. The panic hook first stores the panic message
//! as the output so that JS can report it.

use std::cell::RefCell;
use std::sync::Arc;

use graphql_js::language::ast::DocumentNode;
use grats::grats_config::GratsConfig;
use grats::host::{Host, JsonHost};
use grats::program::ProgramOptions;
use grats::source_table::SourceTable;
use grats::utils::diagnostic_error::{Diagnostic, locationless_err};
use grats::utils::format_diagnostics::{ReportableDiagnostic, reportable_diagnostics};
use serde::{Deserialize, Serialize};

thread_local! {
    static OUTPUT: RefCell<String> = const { RefCell::new(String::new()) };

    /// The document from the last `run_pipeline` call, as transformed by it, if
    /// it was valid. The other entry points print it, so the document never
    /// crosses. It's kept until the next `run_pipeline` call, since a caller
    /// may print it more than once.
    static PIPELINE_DOC: RefCell<Option<DocumentNode>> = const { RefCell::new(None) };
}

#[cfg(target_arch = "wasm32")]
#[link(wasm_import_module = "grats")]
unsafe extern "C" {
    fn host_call(ptr: *const u8, len: usize, out_ptr: *mut *mut u8) -> usize;
}

/// Sends a request to the host and returns its response.
#[cfg(target_arch = "wasm32")]
fn call_host(request: String) -> String {
    let mut out_ptr: *mut u8 = std::ptr::null_mut();
    let len = unsafe { host_call(request.as_ptr(), request.len(), &mut out_ptr) };
    let bytes = unsafe { Vec::from_raw_parts(out_ptr, len, len) };
    String::from_utf8(bytes).expect("Host responses should be UTF-8")
}

/// There's only a host when the module is loaded as WebAssembly. This
/// lets the crate build for other targets, like `cargo test`.
#[cfg(not(target_arch = "wasm32"))]
fn call_host(_request: String) -> String {
    unimplemented!("The host is only available in WebAssembly")
}

fn with_pipeline_doc<R>(f: impl FnOnce(&DocumentNode) -> R) -> R {
    PIPELINE_DOC.with(|kept| {
        let kept = kept.borrow();
        f(kept
            .as_ref()
            .expect("Expected a document kept by `run_pipeline`"))
    })
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
    reserve_heap(len * 4);
    let bytes = unsafe { Vec::from_raw_parts(ptr, len, len) };
    let input = String::from_utf8(bytes).expect("Input should be UTF-8");
    set_output(f(input));
}

/// Growing wasm memory is slow, and the allocator grows it in small steps as it
/// needs more. Under JS heap pressure, like in the CLI, each step can also
/// trigger garbage collections. So we grow memory in one step: allocating and
/// freeing a buffer leaves it free for the allocations that follow.
///
/// A parsed input takes about as much memory as its JSON, and what's built
/// from it (like a schema) and the output take more. Four times the input
/// covers it: on a 10k-file benchmark it made printing with the enums module
/// ~20% faster than reserving just the input's size.
fn reserve_heap(bytes: usize) {
    drop(std::hint::black_box(Vec::<u8>::with_capacity(bytes)));
}

fn json_host() -> Arc<dyn Host> {
    Arc::new(JsonHost::new(call_host))
}

/// Formats diagnostics whose locations refer to `sources`, relative to the
/// host's current directory.
fn report(
    diagnostics: Vec<Diagnostic>,
    sources: &SourceTable,
    host: &dyn Host,
) -> Vec<ReportableDiagnostic> {
    reportable_diagnostics(diagnostics, sources, &host.current_directory())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoadProjectRequest {
    /// If there's none, the `tsconfig.json` is found from the current
    /// directory.
    config_path: Option<String>,
    use_case_sensitive_file_names: bool,
}

/// Input: a `LoadProjectRequest`, as JSON. Output: the `Project` (see
/// `grats::project`) its `tsconfig.json` describes, or the diagnostics (see
/// `ReportableDiagnostic`), as a JSON `Result` (see `src/utils/Result.ts`).
///
/// # Safety
///
/// See `call`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn load_project(ptr: *mut u8, len: usize) {
    unsafe {
        call(ptr, len, |input| {
            let request: LoadProjectRequest =
                serde_json::from_str(&input).expect("Input should be a LoadProjectRequest");
            let host = json_host();
            let result = grats::project::load_project(
                request.config_path.as_deref(),
                request.use_case_sensitive_file_names,
                Arc::clone(&host),
            );
            result_json(result.map_err(|errors| report(errors, &SourceTable::default(), &*host)))
        })
    }
}

/// Input: the `grats` key of a `tsconfig.json`, as JSON. Output: the
/// `ValidatedConfig` (see `grats::grats_config`), or the diagnostics (see
/// `ReportableDiagnostic`), as a JSON `Result` (see `src/utils/Result.ts`).
///
/// # Safety
///
/// See `call`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn validate_grats_options(ptr: *mut u8, len: usize) {
    unsafe {
        call(ptr, len, |input| {
            let options: serde_json::Value =
                serde_json::from_str(&input).expect("Input should be JSON");
            let result = grats::grats_config::validate_grats_options(Some(&options));
            // The error has no location, so there's no need to ask the host
            // for the directory its path would be relative to.
            result_json(result.map_err(|message| {
                reportable_diagnostics(vec![locationless_err(message)], &SourceTable::default(), "")
            }))
        })
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PipelineRequest {
    config: GratsConfig,
    /// See `grats::grats_root`.
    grats_root: String,
    program: ProgramOptions,
}

/// Input: a `PipelineRequest`, as JSON. Output: the
/// diagnostics (see `ReportableDiagnostic`), as a JSON `Result` (see
/// `src/utils/Result.ts`).
///
/// If the document is valid, it's kept for the entry points which follow.
///
/// # Safety
///
/// See `call`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn run_pipeline(ptr: *mut u8, len: usize) {
    unsafe {
        call(ptr, len, |input| {
            PIPELINE_DOC.with(|kept| *kept.borrow_mut() = None);
            let request: PipelineRequest =
                serde_json::from_str(&input).expect("Input should be a PipelineRequest");
            let host = json_host();
            let sources = SourceTable::default();
            let result = match grats::pipeline::run(
                &request.config,
                &request.grats_root,
                &request.program,
                Arc::clone(&host),
                &sources,
            ) {
                Ok(doc) => {
                    PIPELINE_DOC.with(|kept| *kept.borrow_mut() = Some(doc));
                    Ok(())
                }
                Err(errors) => Err(report(errors, &sources, &*host)),
            };
            result_json(result)
        })
    }
}

/// Input: an `OutputRequest` (see `grats::print_schema`), as JSON. Output:
/// the printed `Outputs` for the document kept by `run_pipeline`, as JSON.
///
/// # Safety
///
/// See `call`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn print_outputs(ptr: *mut u8, len: usize) {
    unsafe {
        call(ptr, len, |input| {
            let request = serde_json::from_str(&input).expect("Input should be an OutputRequest");
            let outputs = with_pipeline_doc(|doc| grats::print_schema::print_outputs(doc, request));
            serde_json::to_string(&outputs).expect("Outputs should serialize")
        })
    }
}

/// Input: `null`. Output: the SDL for the document kept by `run_pipeline`,
/// without Grats' metadata.
///
/// # Safety
///
/// See `call`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn print_sdl_without_metadata(ptr: *mut u8, len: usize) {
    unsafe {
        call(ptr, len, |_input| {
            with_pipeline_doc(grats::print_schema::print_sdl_without_metadata)
        })
    }
}

fn result_json<T: Serialize, E: Serialize>(result: Result<T, E>) -> String {
    let json = match result {
        Ok(value) => serde_json::json!({ "kind": "OK", "value": value }),
        Err(err) => serde_json::json!({ "kind": "ERROR", "err": err }),
    };
    json.to_string()
}
