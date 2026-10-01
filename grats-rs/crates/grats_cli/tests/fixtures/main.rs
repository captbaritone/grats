//! PORT: `src/tests/test.ts` and `src/tests/TestRunner.ts`, for the fixtures
//! in `src/tests/fixtures` and `src/tests/configParserFixtures`. Each fixture
//! is transformed and the result compared to its `.expected.md` file.
//!
//! For the fixtures in `src/tests/integrationFixtures`, this generates the
//! schema of each `index.ts` and compares it to the generated files in its
//! directory. `pnpm test` then executes their queries against them.
//!
//! For the website's `.grats.ts` snippets, this generates the `.out` file
//! shown with each, so changes to the docs are reviewed as fixture changes.
//!
//! Run with `cargo test --test fixtures`. Pass `-- --write` to write the
//! actual output to the expected output files, and delete unexpected files,
//! and a name to run only the fixtures whose paths contain it.

mod markdown;

use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};

use grats::fix_fixable::{FixOptions, apply_fixes};
use grats::grats_config::{GratsConfig, validate_grats_options};
use grats::host::{DirEntries, FileKind, Host};
use grats::locate::{LocateRequest, locate_in_document};
use grats::print_schema::{OutputRequest, print_outputs, print_sdl_without_metadata};
use grats::program::ProgramOptions;
use grats::source_table::SourceTable;
use grats::utils::diagnostic_error::{
    CodeFixAction, Diagnostic, TextChange, gql_err, locationless_err,
};
use grats::utils::format_diagnostics::reportable_diagnostics;
use grats::utils::path;
use grats_cli::native_host::{self, NativeHost};
use libtest_mimic::{Arguments, Failed, Trial};
use serde_json::{Value, json};

use markdown::Markdown;

/// The fixtures transformed by each kind of transformer.
#[derive(Clone, Copy)]
enum Kind {
    /// `.ts` files, whose schema is built.
    Schema,
    /// `.json` files, which are Grats configs.
    Config,
    /// `index.ts` files, whose schema is generated next to them.
    Integration,
    /// The website's `.grats.ts` snippets, whose `.out` files are generated
    /// next to them.
    Snippet,
}

impl Kind {
    fn is_test_file(self, file_name: &str) -> bool {
        match self {
            Kind::Schema => file_name.ends_with(".ts"),
            Kind::Config => file_name.ends_with(".json"),
            Kind::Integration => file_name == "index.ts" || file_name.ends_with("/index.ts"),
            Kind::Snippet => file_name.ends_with(".grats.ts"),
        }
    }

    /// Whether the file, if it doesn't belong to a fixture, is unexpected.
    /// The website's directories contain more than snippets.
    fn is_fixture_file(self, file_name: &str) -> bool {
        match self {
            Kind::Schema | Kind::Config | Kind::Integration => true,
            Kind::Snippet => file_name.ends_with(".out"),
        }
    }

    /// The files which belong to the fixture, besides itself, relative to the
    /// fixtures directory.
    fn fixture_files(self, fixtures_dir: &str, fixture: &str) -> Vec<String> {
        let expected = format!("{fixture}.expected.md");
        match self {
            Kind::Schema | Kind::Config => vec![expected],
            Kind::Snippet => vec![snippet_out_file(fixture)],
            Kind::Integration => {
                let code = read(&format!("{fixtures_dir}/{fixture}"));
                let dir = path::dirname(fixture);
                let mut files = vec![expected];
                files.extend(
                    integration_outputs(&integration_config(&code))
                        .into_iter()
                        .map(|output| format!("{dir}/{output}")),
                );
                files
            }
        }
    }
}

/// What a transformer produced: the output if the fixture succeeded, or the
/// errors.
type TransformerResult = Result<Markdown, Markdown>;

fn main() {
    let mut write = false;
    let args = std::env::args().filter(|arg| {
        let is_write = arg == "--write";
        write |= is_write;
        !is_write
    });
    let args = Arguments::from_iter(args.collect::<Vec<_>>());

    let repo = repo_root();
    let mut trials = Vec::new();
    for (dir, kind) in [
        ("src/tests/configParserFixtures", Kind::Config),
        ("src/tests/fixtures", Kind::Schema),
        ("src/tests/integrationFixtures", Kind::Integration),
        ("website/docs", Kind::Snippet),
        ("website/src", Kind::Snippet),
    ] {
        let fixtures_dir = format!("{repo}/{dir}");
        let mut test_fixtures = Vec::new();
        let mut other_files = HashSet::new();
        for file_name in read_dir_recursive(&fixtures_dir) {
            if kind.is_test_file(&file_name) {
                test_fixtures.push(file_name);
            } else if kind.is_fixture_file(&file_name) {
                other_files.insert(file_name);
            }
        }
        for fixture in &test_fixtures {
            for file_name in kind.fixture_files(&fixtures_dir, fixture) {
                other_files.remove(&file_name);
            }
        }
        for fixture in test_fixtures {
            let fixtures_dir = fixtures_dir.clone();
            let name = format!("{dir}/{fixture}");
            trials.push(Trial::test(name, move || match kind {
                Kind::Schema => test_fixture(&fixtures_dir, &fixture, transform_schema, write),
                Kind::Config => test_fixture(
                    &fixtures_dir,
                    &fixture,
                    |code, _| transform_config(code),
                    write,
                ),
                Kind::Integration => test_integration_fixture(&fixtures_dir, &fixture, write),
                Kind::Snippet => test_snippet(&fixtures_dir, &fixture, write),
            }));
        }
        let mut other_files: Vec<_> = other_files.into_iter().collect();
        other_files.sort();
        trials.push(Trial::test(
            format!("{dir} has no unexpected files"),
            move || check_other_files(&fixtures_dir, &other_files, write),
        ));
    }
    libtest_mimic::run(&args, trials).exit();
}

/// The repository's root, as a Grats path (see `grats::host`).
fn repo_root() -> String {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let root = fs::canonicalize(&root).expect("Expected the repository's root to exist");
    native_host::to_grats_path(&root)
}

/// The root which Grats' module paths are relative to. As in the TypeScript
/// tests, it's the repository's parent, so paths start with `grats/`.
fn grats_root() -> String {
    path::resolve(&repo_root(), "..")
}

/// The paths of the files in `dir` and its subdirectories, relative to it,
/// sorted.
fn read_dir_recursive(dir: &str) -> Vec<String> {
    let mut files = Vec::new();
    let entries =
        fs::read_dir(native_host::from_grats_path(dir)).expect("Expected to read fixtures");
    for entry in entries {
        let entry = entry.expect("Expected to read a fixture");
        let name = entry.file_name().to_string_lossy().into_owned();
        if entry.file_type().is_ok_and(|kind| kind.is_dir()) {
            for file in read_dir_recursive(&format!("{dir}/{name}")) {
                files.push(format!("{name}/{file}"));
            }
        } else {
            files.push(name);
        }
    }
    files.sort();
    files
}

/// The options given as JSON on the fixture's first line, if any.
fn test_options(code: &str) -> Option<serde_json::Map<String, Value>> {
    let first_line = code.split('\n').next().unwrap_or("");
    if !first_line.starts_with("// {") {
        return None;
    }
    let options = serde_json::from_str(&first_line[3..]).expect("Expected options to be JSON");
    match options {
        Value::Object(options) => Some(options),
        _ => panic!("Expected options to be an object"),
    }
}

fn read(path: &str) -> String {
    fs::read_to_string(native_host::from_grats_path(path))
        .unwrap_or_else(|error| panic!("Expected to read {path}: {error}"))
}

/// Transforms the fixture's content, given its path.
type Transformer = fn(&str, &str) -> TransformerResult;

fn test_fixture(
    fixtures_dir: &str,
    fixture: &str,
    transformer: Transformer,
    write: bool,
) -> Result<(), Failed> {
    let expected_file_path = format!("{fixtures_dir}/{fixture}.expected.md");
    let fixture_path = format!("{fixtures_dir}/{fixture}");
    let fixture_content = read(&fixture_path);

    let transform_result = transformer(&fixture_content, &fixture_path);
    let actual_has_error = transform_result.is_err();
    let actual_output = transform_result.unwrap_or_else(|err| err);

    let file_type = fixture.rsplit('.').next().unwrap_or("");
    let mut output = Markdown::default();
    output.add_header(1, fixture);
    output.add_header(2, "Input");
    output.add_code_block(&fixture_content, file_type, Some(fixture));
    output.add_header(2, "Output");
    output.add_markdown(actual_output);
    let test_output = output.to_string();

    // Validate naming convention: .invalid files should have errors, others
    // should succeed.
    let is_invalid_test = fixture.contains(".invalid.");
    let naming_convention_error = if is_invalid_test && !actual_has_error {
        Some(format!(
            "Test has \".invalid\" in name but succeeded. Fix: rename to \"{}\" or add error to test.",
            fixture.replacen(".invalid", "", 1)
        ))
    } else if !is_invalid_test && actual_has_error {
        Some(format!(
            "Test produced error but missing \".invalid\" in name. Fix: rename to \"{}\" or fix the error.",
            fixture.replacen(".ts", ".invalid.ts", 1)
        ))
    } else {
        None
    };

    compare_or_write(&expected_file_path, &test_output, write)?;
    match naming_convention_error {
        Some(error) => Err(error.into()),
        None => Ok(()),
    }
}

/// Compares the file to its expected content, or writes it in write mode. A
/// missing file is treated as empty.
fn compare_or_write(file_path: &str, actual: &str, write: bool) -> Result<(), Failed> {
    let native_path = native_host::from_grats_path(file_path);
    let expected = fs::read_to_string(&native_path).unwrap_or_default();
    if actual == expected {
        Ok(())
    } else if write {
        fs::write(&native_path, actual).expect("Expected to write the expected output");
        Ok(())
    } else {
        Err(format!(
            "{file_path} did not match. Run with `-- --write` to update fixtures.\n{}",
            similar::TextDiff::from_lines(&expected, actual)
                .unified_diff()
                .header("expected", "actual")
        )
        .into())
    }
}

/// The `.out` file of a website snippet.
fn snippet_out_file(snippet: &str) -> String {
    format!("{}.out", snippet.trim_end_matches(".grats.ts"))
}

/// PORT: `website/scripts/gratsCode.ts`. Generates the snippet's `.out` file:
/// the snippet, its SDL and its `schema.ts`, which the website shows in tabs.
fn test_snippet(snippets_dir: &str, snippet: &str, write: bool) -> Result<(), Failed> {
    let snippet_path = format!("{snippets_dir}/{snippet}");
    let code = read(&snippet_path);
    let config = validate_grats_options(Some(&json!({
        "nullableByDefault": true,
        "importModuleSpecifierEnding": "",
        "schemaHeader": null,
        "tsSchemaHeader": null,
    })))
    .map_err(|message| format!("Invalid config: {message}"))?
    .config;

    let host = Arc::new(FixtureHost::new());
    let sources = SourceTable::default();
    let program = ProgramOptions {
        root_names: vec![snippet_path.clone()],
        tsconfig: Some(format!("{}/website/tsconfig.snippets.json", repo_root())),
        ..program_options(&snippet_path)
    };
    let doc = grats::pipeline::run(&config, &grats_root(), &program, host.clone(), &sources)
        .map_err(|diagnostics| {
            let report = format_diagnostics_with_context(&code, diagnostics, &sources, &host);
            format!("Expected the snippet to be valid:\n{report}")
        })?;
    let outputs = print_outputs(
        &doc,
        OutputRequest {
            config,
            grats_root: grats_root(),
            graphql_schema: false,
            ts_schema: Some(snippet_path.clone()),
            ts_client_enums: None,
            metadata: false,
        },
    );

    let output = format!(
        "{code}\n=== SNIP ===\n{}\n=== SNIP ===\n{}",
        print_sdl_without_metadata(&doc),
        expect_output(outputs.ts_schema)
    );
    compare_or_write(
        &format!("{snippets_dir}/{}", snippet_out_file(snippet)),
        &output,
        write,
    )
}

/// The config of an integration fixture: the defaults, and the options on its
/// first line.
fn integration_config(code: &str) -> Value {
    let mut config = json!({
        "nullableByDefault": true,
        "importModuleSpecifierEnding": ".js",
        "schemaHeader": null,
        "tsSchemaHeader": null,
    });
    if let Some(test_options) = test_options(code) {
        config
            .as_object_mut()
            .expect("Expected the config to be an object")
            .extend(test_options);
    }
    config
}

/// The files generated for an integration fixture, relative to its directory.
fn integration_outputs(config: &Value) -> Vec<&str> {
    let mut outputs = vec!["schema.ts", "schema.graphql"];
    if let Some(enums) = config.get("tsClientEnums").and_then(Value::as_str) {
        outputs.push(enums);
    }
    outputs
}

/// Generates the schema of an integration fixture, and compares each file to
/// the one in its directory.
fn test_integration_fixture(fixtures_dir: &str, fixture: &str, write: bool) -> Result<(), Failed> {
    let fixture_path = format!("{fixtures_dir}/{fixture}");
    let code = read(&fixture_path);
    let config = validate_grats_options(Some(&integration_config(&code)))
        .map_err(|message| format!("Invalid config: {message}"))?
        .config;

    let host = Arc::new(FixtureHost::new());
    let sources = SourceTable::default();
    let program = program_options(&fixture_path);
    let doc = grats::pipeline::run(&config, &grats_root(), &program, host.clone(), &sources)
        .map_err(|diagnostics| {
            let report = format_diagnostics_with_context(&code, diagnostics, &sources, &host);
            format!("Expected the schema to build:\n{report}")
        })?;

    let dir = path::dirname(&fixture_path);
    let schema_path = path::resolve(dir, "schema.ts");
    let enums_path = config
        .ts_client_enums
        .as_ref()
        .map(|enums| path::resolve(dir, enums));
    let outputs = print_outputs(
        &doc,
        OutputRequest {
            config,
            grats_root: grats_root(),
            graphql_schema: true,
            ts_schema: Some(schema_path.clone()),
            ts_client_enums: enums_path.clone(),
            metadata: false,
        },
    );

    let mut files = vec![
        (schema_path, outputs.ts_schema),
        (path::resolve(dir, "schema.graphql"), outputs.graphql_schema),
    ];
    if let Some(enums_path) = enums_path {
        files.push((enums_path, outputs.ts_client_enums));
    }
    let errors: Vec<String> = files
        .into_iter()
        .filter_map(|(file_path, output)| {
            compare_or_write(&file_path, &expect_output(output), write)
                .err()
                .map(|error| error.message().unwrap_or_default().to_string())
        })
        .collect();
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("\n").into())
    }
}

fn check_other_files(
    fixtures_dir: &str,
    other_files: &[String],
    write: bool,
) -> Result<(), Failed> {
    if other_files.is_empty() {
        return Ok(());
    }
    if write {
        for file_name in other_files {
            println!("DELETED: {file_name}");
            fs::remove_file(native_host::from_grats_path(&format!(
                "{fixtures_dir}/{file_name}"
            )))
            .expect("Expected to delete an unexpected file");
        }
        return Ok(());
    }
    Err(format!(
        "Unexpected files found:\n{}\nRun with `-- --write` to delete unexpected files",
        other_files
            .iter()
            .map(|file_name| format!(" - {file_name}"))
            .collect::<Vec<_>>()
            .join("\n")
    )
    .into())
}

fn transform_config(code: &str) -> TransformerResult {
    let config: Value = serde_json::from_str(code).expect("Expected the fixture to be JSON");
    let validated = validate_grats_options(Some(&config))
        .map_err(|message| config_error_report(code, message))?;

    let mut markdown = Markdown::default();
    markdown.add_header(3, "Parsed Config");
    markdown.add_code_block(&pretty_json(&validated.config), "json", None);
    if !validated.warnings.is_empty() {
        markdown.add_header(3, "Warnings");
        markdown.add_code_block(&validated.warnings.join("\n"), "text", None);
    }
    Ok(markdown)
}

fn config_error_report(code: &str, message: String) -> Markdown {
    let host = FixtureHost::new();
    format_diagnostics_with_context(
        code,
        vec![locationless_err(message)],
        &SourceTable::default(),
        &host,
    )
}

fn transform_schema(code: &str, fixture_path: &str) -> TransformerResult {
    let mut config = json!({
        "nullableByDefault": true,
        "schemaHeader": null,
        "tsSchemaHeader": null,
    });
    if let Some(test_options) = test_options(code) {
        config
            .as_object_mut()
            .expect("Expected the config to be an object")
            .extend(test_options);
    }
    let config = validate_grats_options(Some(&config))
        .map_err(|message| config_error_report(code, message))?
        .config;

    let grats_root = grats_root();
    let host = Arc::new(FixtureHost::new());
    let sources = SourceTable::default();
    let program = program_options(fixture_path);
    let doc = grats::pipeline::run(&config, &grats_root, &program, host.clone(), &sources)
        .map_err(|diagnostics| {
            format_diagnostics_with_context(code, diagnostics, &sources, &host)
        })?;

    // We print every output here, even for `// Locate:` fixtures, to ensure
    // that printing doesn't throw.
    let outputs = print_outputs(
        &doc,
        OutputRequest {
            config: config.clone(),
            grats_root,
            graphql_schema: true,
            ts_schema: Some(fixture_path.to_string()),
            ts_client_enums: config
                .ts_client_enums
                .as_ref()
                .map(|enums| path::resolve(path::dirname(fixture_path), enums)),
            metadata: config.experimental_emit_metadata,
        },
    );

    if let Some(entity_name) = code
        .split('\n')
        .next()
        .and_then(|line| line.strip_prefix("// Locate: "))
    {
        return Err(
            match locate_in_document(
                &doc,
                LocateRequest {
                    entity_name: entity_name.trim().to_string(),
                },
            ) {
                Err(message) => {
                    let mut markdown = Markdown::default();
                    markdown.add_header(3, "Error Locating Type");
                    markdown.add_code_block(&message, "text", None);
                    markdown
                }
                Ok(loc) => format_diagnostics_with_context(
                    code,
                    vec![gql_err(Some(loc), "Located here".to_string(), None)],
                    &sources,
                    &host,
                ),
            },
        );
    }

    let mut markdown = Markdown::default();
    markdown.add_header(3, "SDL");
    markdown.add_code_block(&expect_output(outputs.graphql_schema), "graphql", None);
    markdown.add_header(3, "TypeScript");
    markdown.add_code_block(&expect_output(outputs.ts_schema), "ts", None);
    if let Some(metadata) = outputs.metadata {
        markdown.add_header(3, "Metadata");
        markdown.add_code_block(&metadata, "json", None);
    }
    if let Some(enums) = outputs.ts_client_enums {
        markdown.add_header(3, "TypeScript Enums");
        markdown.add_code_block(&enums, "ts", None);
    }
    Ok(markdown)
}

/// The program of a fixture, which can use the types Grats exports.
fn program_options(fixture_path: &str) -> ProgramOptions {
    ProgramOptions {
        root_names: vec![
            fixture_path.to_string(),
            format!("{}/src/Types.ts", repo_root()),
        ],
        allow_js: false,
        tsconfig: None,
        use_case_sensitive_file_names: native_host::use_case_sensitive_file_names(),
    }
}

fn expect_output(output: Option<String>) -> String {
    output.expect("Expected the output to be printed")
}

/// Like `JSON.stringify(value, null, 2)`.
fn pretty_json(config: &GratsConfig) -> String {
    serde_json::to_string_pretty(config).expect("Expected the config to serialize")
}

/// The error report for the diagnostics, followed by the changes each fix
/// makes and the text once they're all applied.
fn format_diagnostics_with_context(
    code: &str,
    diagnostics: Vec<Diagnostic>,
    sources: &SourceTable,
    host: &FixtureHost,
) -> Markdown {
    let fixes: Vec<CodeFixAction> = diagnostics
        .iter()
        .filter_map(|diagnostic| diagnostic.fix.as_deref().cloned())
        .collect();
    let formatted: String = reportable_diagnostics(diagnostics, sources, &host.current_directory())
        .into_iter()
        .map(|diagnostic| diagnostic.formatted)
        .collect();

    let mut markdown = Markdown::default();
    markdown.add_header(3, "Error Report");
    markdown.add_code_block(&strip_color(&formatted), "text", None);

    if fixes.is_empty() {
        return markdown;
    }

    for fix in &fixes {
        let mut text_changes: Vec<&TextChange> = fix
            .changes
            .iter()
            .flat_map(|change| &change.text_changes)
            .collect();
        // Process edits in reverse to avoid changing the span of subsequent
        // edits.
        text_changes.sort_by_key(|text_change| std::cmp::Reverse(text_change.span.start));
        let mut new_code: Vec<u16> = code.encode_utf16().collect();
        for text_change in text_changes {
            let start = (text_change.span.start as usize).min(new_code.len());
            let end = (start + text_change.span.length as usize).min(new_code.len());
            new_code.splice(start..end, text_change.new_text.encode_utf16());
        }
        let new_code = String::from_utf16_lossy(&new_code);
        markdown.add_header(
            4,
            &format!("Code Action: \"{}\" ({})", fix.description, fix.fix_name),
        );
        let diff = similar::TextDiff::from_lines(code, &new_code)
            .unified_diff()
            .context_radius(1)
            .header("Original", "Fixed")
            .to_string();
        markdown.add_code_block(&diff, "diff", None);
    }

    let file_name = fixes[0]
        .changes
        .first()
        .map(|change| change.file_name.clone())
        .expect("Cannot apply fixes to diagnostic with no changes");
    let log_events = RefCell::new(Vec::new());
    let log = |event: &str| log_events.borrow_mut().push(event.to_string());
    let fix_refs: Vec<&CodeFixAction> = fixes.iter().collect();
    apply_fixes(
        &fix_refs,
        &FixOptions {
            fix: true,
            log: &log,
        },
        host,
        &grats_root(),
    );
    let new_text = host
        .read_file(&file_name)
        .expect("Expected to read the fixed file");

    markdown.add_header(4, "Applied Fixes");
    markdown.add_code_block(&log_events.borrow().join("\n"), "text", None);
    markdown.add_header(4, "Fixed Text");
    markdown.add_code_block(&new_text, "typescript", None);
    markdown
}

/// Removes ANSI escape sequences.
fn strip_color(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    let mut chars = text.chars();
    while let Some(ch) = chars.next() {
        if ch == '\x1b' {
            for ch in chars.by_ref() {
                if ch.is_ascii_alphabetic() {
                    break;
                }
            }
        } else {
            output.push(ch);
        }
    }
    output
}

/// The file system, except that the repository's root is the current
/// directory, and files are written to memory, so applying fixes leaves the
/// fixtures unchanged.
struct FixtureHost {
    current_directory: String,
    written: Mutex<HashMap<String, String>>,
}

impl FixtureHost {
    fn new() -> Self {
        FixtureHost {
            current_directory: repo_root(),
            written: Mutex::new(HashMap::new()),
        }
    }
}

impl Host for FixtureHost {
    fn read_file(&self, path: &str) -> Option<String> {
        let written = self.written.lock().expect("Expected the lock");
        written
            .get(path)
            .cloned()
            .or_else(|| NativeHost.read_file(path))
    }

    fn stat(&self, path: &str, follow_links: bool) -> Option<FileKind> {
        NativeHost.stat(path, follow_links)
    }

    fn read_link(&self, path: &str) -> Option<String> {
        NativeHost.read_link(path)
    }

    fn realpath(&self, path: &str) -> Option<String> {
        NativeHost.realpath(path)
    }

    fn read_dir(&self, path: &str) -> Option<DirEntries> {
        NativeHost.read_dir(path)
    }

    fn current_directory(&self) -> String {
        self.current_directory.clone()
    }

    fn write_file(&self, path: &str, contents: &str) -> Result<(), String> {
        let mut written = self.written.lock().expect("Expected the lock");
        written.insert(path.to_string(), contents.to_string());
        Ok(())
    }

    fn log(&self, message: &str) {
        println!("{message}");
    }

    fn log_error(&self, message: &str) {
        eprintln!("{message}");
    }
}
