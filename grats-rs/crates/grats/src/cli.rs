//! The `grats` command line interface.
//!
//! Output goes through the host, and `run` returns the exit code rather than
//! exiting. For `--watch`, `run` returns, and the caller (the native `grats`
//! binary) watches the files and rebuilds with `WatchMode`.

use std::sync::Arc;

use clap::{CommandFactory, FromArgMatches, Parser, Subcommand};
use graphql_js::language::ast::DocumentNode;

use crate::fix_fixable::{FixOptions, apply_fixes, with_fixes_fixed};
use crate::grats_config::GratsConfig;
use crate::host::Host;
use crate::locate::locate_in_document;
use crate::pipeline;
use crate::print_schema::{OutputRequest, print_outputs};
use crate::project::{self, Project};
use crate::source_table::SourceTable;
use crate::utils::diagnostic_error::{Diagnostic, DiagnosticsResult, locationless_err};
use crate::utils::format_diagnostics::{
    format_diagnostic_with_color_and_context, format_location_without_color,
    format_message_with_color,
};
use crate::utils::path;

#[derive(Debug)]
pub struct CliRequest {
    /// The arguments, after the program's name.
    pub args: Vec<String>,
    /// The version of the `grats` package.
    pub version: String,
    /// The root which module paths are relative to. See `crate::grats_root`.
    pub grats_root: String,
    pub use_case_sensitive_file_names: bool,
}

/// What to do once the command has run.
#[derive(Debug)]
pub enum CliOutcome {
    /// Exit with this code.
    Exit { code: i32 },
    /// Start watch mode, with the `--tsconfig` as the user wrote it.
    Watch { tsconfig: Option<String>, fix: bool },
}

// Help, the version and usage errors are printed as clap formats them. Doc
// comments here are the help text.

/// Extract GraphQL schema from your TypeScript project
#[derive(Debug, Parser)]
#[command(name = "grats")]
struct Args {
    /// Path to tsconfig.json. Defaults to auto-detecting based on the current working directory
    #[arg(long, value_name = "TSCONFIG")]
    tsconfig: Option<String>,
    /// Watch for changes and rebuild schema files as needed
    #[arg(long)]
    watch: bool,
    /// Automatically fix fixable diagnostics
    #[arg(long)]
    fix: bool,
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Print the location of a GraphQL entity
    Locate {
        /// GraphQL entity to locate. E.g. `User` or `User.id`
        #[arg(value_name = "ENTITY")]
        entity: String,
        /// Path to tsconfig.json. Defaults to auto-detecting based on the current working directory
        #[arg(long, value_name = "TSCONFIG")]
        tsconfig: Option<String>,
    },
}

/// Exit with code 1, once the reason has been reported.
struct Exit;

struct Cli {
    host: Arc<dyn Host>,
    grats_root: String,
    use_case_sensitive_file_names: bool,
    /// The sources which the locations of every diagnostic refer to.
    sources: SourceTable,
}

/// Parses the arguments and runs the command.
pub fn run(request: CliRequest, host: Arc<dyn Host>) -> CliOutcome {
    let args = match parse_args(request.args, request.version) {
        Ok(args) => args,
        Err(error) => {
            // Help and the version are "errors" too, which go to stdout.
            let message = error.render().to_string();
            let message = message.trim_end();
            if error.use_stderr() {
                host.log_error(message);
            } else {
                host.log(message);
            }
            return CliOutcome::Exit {
                code: error.exit_code(),
            };
        }
    };
    let cli = Cli {
        host,
        grats_root: request.grats_root,
        use_case_sensitive_file_names: request.use_case_sensitive_file_names,
        sources: SourceTable::default(),
    };
    let result = match args.command {
        Some(Command::Locate { entity, tsconfig }) => cli.locate(tsconfig.as_deref(), &entity),
        None if args.watch => {
            return CliOutcome::Watch {
                tsconfig: args.tsconfig,
                fix: args.fix,
            };
        }
        None => cli.run_build(args.tsconfig.as_deref(), args.fix),
    };
    CliOutcome::Exit {
        code: if result.is_ok() { 0 } else { 1 },
    }
}

fn parse_args(args: Vec<String>, version: String) -> Result<Args, clap::Error> {
    let mut command = Args::command().version(version);
    let matches =
        command.try_get_matches_from_mut(std::iter::once("grats".to_string()).chain(args))?;
    Args::from_arg_matches(&matches).map_err(|error| error.format(&mut command))
}

/// Run the compiler in watch mode.
///
/// The caller watches the files and calls `rebuild`. Messages are formatted
/// like those of TypeScript's watch mode.
pub struct WatchMode {
    host: Arc<dyn Host>,
    grats_root: String,
    use_case_sensitive_file_names: bool,
    tsconfig: Option<String>,
    fix: bool,
}

pub struct WatchRequest {
    /// The `--tsconfig`, as the user wrote it.
    pub tsconfig: Option<String>,
    pub fix: bool,
    /// See `CliRequest`.
    pub grats_root: String,
    pub use_case_sensitive_file_names: bool,
}

impl WatchMode {
    /// Checks that the project can be loaded, or reports why not.
    pub fn start(request: WatchRequest, host: Arc<dyn Host>) -> Option<Self> {
        let watch_mode = WatchMode {
            host,
            grats_root: request.grats_root,
            use_case_sensitive_file_names: request.use_case_sensitive_file_names,
            tsconfig: request.tsconfig,
            fix: request.fix,
        };
        // Config errors are never fixable.
        let cli = watch_mode.cli();
        cli.handle_diagnostics(cli.load_project(watch_mode.tsconfig.as_deref()))
            .ok()?;
        watch_mode.report_message("Starting compilation in watch mode...");
        Some(watch_mode)
    }

    /// Reports that the files have changed, before a rebuild.
    pub fn report_change(&self) {
        self.report_message("File change detected. Starting incremental compilation...");
    }

    /// Rebuilds the schema, or reports why it couldn't.
    ///
    /// Returns true if fixes were applied, in which case it should rebuild
    /// again.
    pub fn rebuild(&self) -> bool {
        // Each build's sources, rather than every build's.
        let cli = self.cli();
        let fix_or_report = |diagnostics: Vec<Diagnostic>| {
            let fixes: Vec<_> = diagnostics
                .iter()
                .filter_map(|diagnostic| diagnostic.fix.as_deref())
                .collect();
            let log = |message: &str| self.host.log_error(message);
            let options = FixOptions {
                fix: true,
                log: &log,
            };
            if self.fix && apply_fixes(&fixes, &options, &*self.host, &self.grats_root) {
                // Watch mode should re-run after applying fixes
                return true;
            }
            let _ = cli.handle_diagnostics::<()>(Err(diagnostics));
            false
        };

        // It's possible our config was updated, so re-read it.
        let project = match cli.load_project(self.tsconfig.as_deref()) {
            Ok(project) => project,
            Err(diagnostics) => return fix_or_report(diagnostics),
        };
        // For now we just rebuild the schema on every change.
        let doc = match cli.build_schema_and_doc(&project) {
            Ok(doc) => doc,
            Err(diagnostics) => return fix_or_report(diagnostics),
        };
        let _ = cli.handle_diagnostics(write_schema_files_and_report(
            &doc,
            &project.config,
            &project.config_path,
            &self.grats_root,
            &*self.host,
        ));
        false
    }

    fn cli(&self) -> Cli {
        Cli {
            host: Arc::clone(&self.host),
            grats_root: self.grats_root.clone(),
            use_case_sensitive_file_names: self.use_case_sensitive_file_names,
            sources: SourceTable::default(),
        }
    }

    fn report_message(&self, message_text: &str) {
        self.host
            .log_error(&format_message_with_color(message_text));
    }
}

impl Cli {
    fn locate(&self, tsconfig: Option<&str>, entity: &str) -> Result<(), Exit> {
        let project = self.handle_diagnostics(self.load_project(tsconfig))?;

        let doc = self.handle_diagnostics(self.build_schema_and_doc(&project))?;

        match locate_in_document(&doc, entity) {
            Err(message) => {
                self.host.log_error(&message);
                Err(Exit)
            }
            // Tools like VS Code and iTerm will automatically turn this into
            // a clickable link.
            Ok(loc) => {
                self.host
                    .log(&format_location_without_color(&self.sources, &loc));
                Ok(())
            }
        }
    }

    /// Run the compiler performing a single build.
    fn run_build(&self, tsconfig: Option<&str>, fix: bool) -> Result<(), Exit> {
        let log = |message: &str| self.host.log_error(message);
        let options = FixOptions { fix, log: &log };
        let project = self.handle_diagnostics(with_fixes_fixed(
            || self.load_project(tsconfig),
            &options,
            &*self.host,
            &self.grats_root,
        ))?;
        let doc = self.handle_diagnostics(with_fixes_fixed(
            || self.build_schema_and_doc(&project),
            &options,
            &*self.host,
            &self.grats_root,
        ))?;
        self.handle_diagnostics(write_schema_files_and_report(
            &doc,
            &project.config,
            &project.config_path,
            &self.grats_root,
            &*self.host,
        ))
    }

    /// Loads the project, printing any warnings about the config.
    fn load_project(&self, tsconfig: Option<&str>) -> DiagnosticsResult<Project> {
        let tsconfig =
            tsconfig.map(|tsconfig| path::from_native(&self.host.current_directory(), tsconfig));
        let project = project::load_project(
            tsconfig.as_deref(),
            self.use_case_sensitive_file_names,
            Arc::clone(&self.host),
        )?;
        for warning in &project.warnings {
            self.host.log_error(warning);
        }
        Ok(project)
    }

    fn build_schema_and_doc(&self, project: &Project) -> DiagnosticsResult<DocumentNode> {
        pipeline::run(
            &project.config,
            &self.grats_root,
            &project.program,
            Arc::clone(&self.host),
            &self.sources,
        )
    }

    /// Utility function to report diagnostics to the console.
    fn handle_diagnostics<T>(&self, result: DiagnosticsResult<T>) -> Result<T, Exit> {
        result.map_err(|diagnostics| {
            let current_directory = self.host.current_directory();
            let formatted: String = diagnostics
                .iter()
                .map(|diagnostic| {
                    format_diagnostic_with_color_and_context(
                        diagnostic,
                        &self.sources,
                        &current_directory,
                    )
                })
                .collect();
            self.host.log_error(&formatted);
            Exit
        })
    }
}

/// Serializes the SDL and TypeScript schema to disk and reports to the console,
/// or reports a file which can't be written.
fn write_schema_files_and_report(
    doc: &DocumentNode,
    grats_config: &GratsConfig,
    config_path: &str,
    grats_root: &str,
    host: &dyn Host,
) -> DiagnosticsResult<()> {
    let config_dir = path::dirname(config_path);
    let write_file = |path: &str, contents: Option<String>, description: &str| {
        let contents = contents.expect("Expected the requested output to be printed");
        let native_path = path::to_native(path);
        host.write_file(path, &contents).map_err(|error| {
            vec![locationless_err(format!(
                "Grats: Could not write `{native_path}`: {error}"
            ))]
        })?;
        host.log_error(&format!("Grats: Wrote {description} to `{native_path}`."));
        DiagnosticsResult::Ok(())
    };

    let dest = path::resolve(config_dir, &grats_config.ts_schema);
    let enums_dest = grats_config
        .ts_client_enums
        .as_ref()
        .map(|ts_client_enums| path::resolve(config_dir, ts_client_enums));
    let outputs = print_outputs(
        doc,
        OutputRequest {
            config: grats_config.clone(),
            grats_root: grats_root.to_string(),
            graphql_schema: true,
            ts_schema: Some(dest.clone()),
            ts_client_enums: enums_dest.clone(),
            metadata: grats_config.experimental_emit_metadata,
        },
    );

    write_file(&dest, outputs.ts_schema, "TypeScript schema")?;

    let abs_output = path::resolve(config_dir, &grats_config.graphql_schema);
    write_file(&abs_output, outputs.graphql_schema, "schema")?;

    if grats_config.experimental_emit_metadata {
        let abs_output = path::resolve(config_dir, &metadata_path(&grats_config.graphql_schema));
        write_file(&abs_output, outputs.metadata, "resolver signatures")?;
    }

    if let Some(enums_dest) = enums_dest {
        write_file(&enums_dest, outputs.ts_client_enums, "enums module")?;
    }
    Ok(())
}

/// The path of the metadata JSON: the GraphQL schema's path, with `.json` in
/// place of its `.graphql` extension, or appended if it has another.
fn metadata_path(graphql_schema: &str) -> String {
    let stem = graphql_schema
        .strip_suffix(".graphql")
        .unwrap_or(graphql_schema);
    format!("{stem}.json")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metadata_path_differs_from_schema_path() {
        assert_eq!(metadata_path("./schema.graphql"), "./schema.json");
        assert_eq!(metadata_path("./schema.gql"), "./schema.gql.json");
        assert_eq!(metadata_path("./schema"), "./schema.json");
    }
}
