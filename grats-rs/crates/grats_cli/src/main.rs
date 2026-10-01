//! The `grats` command line tool.

mod native_host;

use std::process::ExitCode;
use std::sync::Arc;

use grats::cli::{self, CliOutcome, CliRequest};

use native_host::NativeHost;

fn main() -> ExitCode {
    let host = Arc::new(NativeHost);
    let request = CliRequest {
        args: std::env::args().skip(1).collect(),
        version: env!("GRATS_VERSION").to_string(),
        grats_root: native_host::grats_root(),
        use_case_sensitive_file_names: native_host::use_case_sensitive_file_names(),
    };
    match cli::run(request, host) {
        CliOutcome::Exit { code } => ExitCode::from(code as u8),
        CliOutcome::Watch { .. } => {
            eprintln!("Grats: Watch mode is not supported yet.");
            ExitCode::FAILURE
        }
    }
}
