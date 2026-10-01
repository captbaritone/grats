//! Port of `src/cli.ts`.
//!
//! PORT: Watch mode stays in TypeScript for now: `run` asks for it once the
//! arguments are parsed, and it writes the outputs and applies fixes through
//! the entry points of `grats_wasm`. Output goes through the host, and `run`
//! returns the exit code rather than exiting.

use std::sync::Arc;

use clap::{CommandFactory, FromArgMatches, Parser, Subcommand};
use graphql_js::language::ast::DocumentNode;
use serde::{Deserialize, Serialize};

use crate::fix_fixable::{FixOptions, with_fixes_fixed};
use crate::grats_config::GratsConfig;
use crate::host::Host;
use crate::locate::{LocateRequest, locate_in_document};
use crate::pipeline::{self, PipelineRequest};
use crate::print_schema::{OutputRequest, print_outputs};
use crate::project::{self, Project};
use crate::source_table::SourceTable;
use crate::utils::diagnostic_error::{DiagnosticsWithoutLocationResult, locationless_err};
use crate::utils::format_diagnostics::{
    format_diagnostic_with_color_and_context, format_location_without_color,
};
use crate::utils::path;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliRequest {
    /// The arguments, after the program's name.
    pub args: Vec<String>,
    /// The version of the `grats` package.
    pub version: String,
    /// The absolute path of `src/gratsRoot.ts`'s root. See `src/grats_root.rs`.
    pub grats_root: String,
    pub use_case_sensitive_file_names: bool,
}

/// What to do once the command has run.
#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CliOutcome {
    /// Exit with this code.
    Exit { code: i32 },
    /// Start watch mode, which is still TypeScript, with the `--tsconfig` as
    /// the user wrote it.
    Watch { tsconfig: Option<String>, fix: bool },
}

// PORT: Replaces commander. Help, the version and usage errors are printed
// as clap formats them. Doc comments here are the help text.

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

/// PORT: `process.exit(1)`.
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
    let code = match result {
        Ok(()) => 0,
        Err(Exit) => 1,
    };
    CliOutcome::Exit { code }
}

fn parse_args(args: Vec<String>, version: String) -> Result<Args, clap::Error> {
    let mut command = Args::command().version(version);
    let matches =
        command.try_get_matches_from_mut(std::iter::once("grats".to_string()).chain(args))?;
    Args::from_arg_matches(&matches).map_err(|error| error.format(&mut command))
}

impl Cli {
    fn locate(&self, tsconfig: Option<&str>, entity: &str) -> Result<(), Exit> {
        let project = self.handle_diagnostics(self.load_project(tsconfig))?;

        let doc = self.handle_diagnostics(self.build_schema_and_doc(&project))?;

        let request = LocateRequest {
            entity_name: entity.to_string(),
        };
        match locate_in_document(&doc, request) {
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

    /// PORT: `loadProject`, which printed the warnings about the config.
    fn load_project(&self, tsconfig: Option<&str>) -> DiagnosticsWithoutLocationResult<Project> {
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

    /// PORT: `buildSchemaAndDocResult`.
    fn build_schema_and_doc(
        &self,
        project: &Project,
    ) -> DiagnosticsWithoutLocationResult<DocumentNode> {
        let request = PipelineRequest {
            config: project.config.clone(),
            grats_root: self.grats_root.clone(),
            program: project.program.clone(),
        };
        pipeline::run(request, Arc::clone(&self.host), &self.sources)
    }

    /// Utility function to report diagnostics to the console.
    fn handle_diagnostics<T>(
        &self,
        result: DiagnosticsWithoutLocationResult<T>,
    ) -> Result<T, Exit> {
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

/// Serializes the SDL and TypeScript schema to disk and reports to the console.
///
/// PORT: Reports a file which can't be written, where the TypeScript
/// implementation threw.
pub fn write_schema_files_and_report(
    doc: &DocumentNode,
    grats_config: &GratsConfig,
    config_path: &str,
    grats_root: &str,
    host: &dyn Host,
) -> DiagnosticsWithoutLocationResult<()> {
    let config_dir = path::dirname(config_path);
    let write_file = |path: &str, contents: Option<String>| {
        let contents = contents.expect("Expected the requested output to be printed");
        host.write_file(path, &contents).map_err(|error| {
            vec![locationless_err(format!(
                "Grats: Could not write `{}`: {error}",
                path::to_native(path)
            ))]
        })
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

    write_file(&dest, outputs.ts_schema)?;
    host.log_error(&format!(
        "Grats: Wrote TypeScript schema to `{}`.",
        path::to_native(&dest)
    ));

    let abs_output = path::resolve(config_dir, &grats_config.graphql_schema);
    write_file(&abs_output, outputs.graphql_schema)?;
    host.log_error(&format!(
        "Grats: Wrote schema to `{}`.",
        path::to_native(&abs_output)
    ));

    if grats_config.experimental_emit_metadata {
        let graphql_schema = &grats_config.graphql_schema;
        let metadata_path = match graphql_schema.strip_suffix(".graphql") {
            Some(stem) => format!("{stem}.json"),
            None => graphql_schema.clone(),
        };
        let abs_output = path::resolve(config_dir, &metadata_path);
        write_file(&abs_output, outputs.metadata)?;
        host.log_error(&format!(
            "Grats: Wrote resolver signatures to `{}`.",
            path::to_native(&abs_output)
        ));
    }

    if let Some(enums_dest) = enums_dest {
        write_file(&enums_dest, outputs.ts_client_enums)?;
        host.log_error(&format!(
            "Grats: Wrote enums module to `{}`.",
            path::to_native(&enums_dest)
        ));
    }
    Ok(())
}
