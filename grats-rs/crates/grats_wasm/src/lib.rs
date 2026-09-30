//! WebAssembly bindings for the Rust port of Grats, loaded by `src/rs/load.ts`.
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
//! Panics abort, which traps. The panic hook first stores the panic message
//! as the output so that JS can report it.

use std::cell::RefCell;

use graphql_js::language::ast::DocumentNode;
use serde::{Deserialize, Serialize};

thread_local! {
    static OUTPUT: RefCell<String> = const { RefCell::new(String::new()) };

    /// The document from the last `run_pipeline` call, as transformed by it, if
    /// it was valid. The other entry points print it (or locate an entity in
    /// it), so the document only crosses once. It's kept until the next
    /// `run_pipeline` call, since a caller may print it more than once.
    static PIPELINE_DOC: RefCell<Option<DocumentNode>> = const { RefCell::new(None) };
}

/// The input to `run_pipeline`.
#[derive(Deserialize)]
struct DocumentRequest<T> {
    doc: DocumentNode,
    request: T,
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

/// Input: a `DocumentRequest<PipelineRequest>` (see `grats::pipeline`),
/// encoded by `runRustPipeline` in `src/rs/document.ts`. Output: the
/// diagnostics, as a JSON `Result` (see `src/utils/Result.ts`).
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
            let DocumentRequest { doc, request } = serde_json::from_str(&input)
                .expect("Input should be an encoded DocumentRequest<PipelineRequest>");
            drop(input);
            let result = grats::pipeline::run(doc, request).map(|doc| {
                PIPELINE_DOC.with(|kept| *kept.borrow_mut() = Some(doc));
            });
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

/// Input: a `LocateRequest` (see `grats::locate`), as JSON. Output: the
/// location in the document kept by `run_pipeline`, or an error message, as a
/// JSON `Result` (see `src/utils/Result.ts`).
///
/// # Safety
///
/// See `call`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn locate(ptr: *mut u8, len: usize) {
    unsafe {
        call(ptr, len, |input| {
            let request = serde_json::from_str(&input).expect("Input should be a LocateRequest");
            with_pipeline_doc(|doc| result_json(grats::locate::locate_in_document(doc, request)))
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
