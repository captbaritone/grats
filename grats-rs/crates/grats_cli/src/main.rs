//! The `grats` command line tool.

mod watch;

use std::process::ExitCode;
use std::sync::Arc;

use grats::cli::{self, CliOutcome, CliRequest, WatchRequest};

use grats_cli::native_host::{self, NativeHost};

fn main() -> ExitCode {
    let grats_root = native_host::grats_root();
    let use_case_sensitive_file_names = native_host::use_case_sensitive_file_names();
    let request = CliRequest {
        args: std::env::args().skip(1).collect(),
        version: env!("GRATS_VERSION").to_string(),
        grats_root: grats_root.clone(),
        use_case_sensitive_file_names,
    };
    match cli::run(request, Arc::new(NativeHost)) {
        CliOutcome::Exit { code } => ExitCode::from(code as u8),
        CliOutcome::Watch { tsconfig, fix } => watch::run(WatchRequest {
            tsconfig,
            fix,
            grats_root,
            use_case_sensitive_file_names,
        }),
    }
}
