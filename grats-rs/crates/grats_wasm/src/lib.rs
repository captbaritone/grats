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
    reserve_heap(len);
    let bytes = unsafe { Vec::from_raw_parts(ptr, len, len) };
    let input = String::from_utf8(bytes).expect("Input should be UTF-8");
    set_output(f(input));
}

/// Growing wasm memory is slow, and the allocator grows it in small steps as it
/// needs more. A parsed input takes about as much memory as its JSON, so we
/// grow memory by that much in one step: allocating and freeing a buffer of
/// that size leaves it free for the allocations that follow.
fn reserve_heap(bytes: usize) {
    drop(std::hint::black_box(Vec::<u8>::with_capacity(bytes)));
}

/// Input: a `DocumentNode` encoded by `encodeDocument` in `src/rs/codec.ts`.
///
/// # Safety
///
/// See `call`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn print_sdl_without_metadata(ptr: *mut u8, len: usize) {
    unsafe {
        call(ptr, len, |input| {
            let doc =
                serde_json::from_str(&input).expect("Input should be an encoded DocumentNode");
            drop(input);
            grats::print_schema::print_sdl_without_metadata(doc)
        })
    }
}
