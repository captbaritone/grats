#!/usr/bin/env node

// LLM agent docs: See the llm-docs/ directory in the package root for
// Markdown documentation covering all Grats features and configuration.

import * as E from "./Errors.js";
import { Location } from "graphql";
import { SchemaAndDoc, buildSchemaAndDocResult } from "./lib.js";
import { Command } from "commander";
import { writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { locate } from "./Locate.js";
import { printOutputs } from "./printSchema.js";
import { nullThrows } from "./utils/helpers.js";
import * as ts from "typescript";
import {
  diagnosticsMessage,
  locationlessErr,
  ReportableDiagnostics,
  DiagnosticsWithoutLocationResult,
} from "./utils/DiagnosticError.js";
import { GratsConfig } from "./gratsConfig.js";
import { GratsProject, loadProject } from "./rs/project.js";
import { err, ok } from "./utils/Result.js";
import { cacheFromProgram, cachesAreEqual, RunCache } from "./runCache.js";
import { withFixesFixed, FixOptions, applyFixes } from "./fixFixable.js";

type BuildOptions = FixOptions;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const version = readPackageVersion();

function readPackageVersion(): string {
  // Works from both source (src/cli.ts → ../package.json)
  // and compiled output (dist/src/cli.js → ../../package.json)
  for (const relPath of ["../package.json", "../../package.json"]) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(__dirname, relPath), "utf8"));
      if (pkg.name === "grats") return pkg.version;
    } catch {
      // Ignore missing/unreadable package.json files
    }
  }
  console.error(
    "Grats: Could not determine package version. Please report this issue at https://github.com/captbaritone/grats/issues",
  );
  return "unknown";
}

const program = new Command();

program
  .name("grats")
  .description("Extract GraphQL schema from your TypeScript project")
  .version(version)
  .option(
    "--tsconfig <TSCONFIG>",
    "Path to tsconfig.json. Defaults to auto-detecting based on the current working directory",
  )
  .option("--watch", "Watch for changes and rebuild schema files as needed")
  .option("--fix", "Automatically fix fixable diagnostics")
  .action(async ({ tsconfig, watch, fix }) => {
    if (watch) {
      startWatchMode(tsconfig, { fix, log: console.error });
    } else {
      runBuild(tsconfig, { fix, log: console.error });
    }
  });

program
  .command("locate")
  .argument("<ENTITY>", "GraphQL entity to locate. E.g. `User` or `User.id`")
  .option(
    "--tsconfig <TSCONFIG>",
    "Path to tsconfig.json. Defaults to auto-detecting based on the current working directory",
  )
  .action((entity, { tsconfig }) => {
    const { project } = handleDiagnostics(getTsConfig(tsconfig));

    const { doc } = handleDiagnostics(buildSchemaAndDocResult(project));

    const loc = locate(doc, entity);
    if (loc.kind === "ERROR") {
      console.error(loc.err);
      process.exit(1);
    }
    console.log(formatLoc(loc.value));
  });

program.parse();

/**
 * Run the compiler in watch mode.
 */
function startWatchMode(tsconfig: string, options: BuildOptions) {
  const configInfo = handleDiagnostics(
    withFixesFixed(() => getTsConfig(tsconfig), options),
  );
  const { configPath } = configInfo;
  let project = configInfo.project;
  const watchHost = ts.createWatchCompilerHost(
    configPath,
    {},
    ts.sys,
    ts.createSemanticDiagnosticsBuilderProgram,
    (diagnostic) => reportDiagnostics([diagnostic]),
    (diagnostic) => {
      // Some messages we handle ourselves since we ignore some updates. e.g.
      // when we observe a change we ourselves created.
      switch (diagnostic.code) {
        case 6031: // Starting compilation in watch mode...
        case 6032: // File change detected. Starting incremental compilation...
          return;
        default:
          reportDiagnostics([diagnostic]);
      }
    },
  );

  let lastRunCache: RunCache | null = null;
  watchHost.afterProgramCreate = (builderProgram) => {
    const program = builderProgram.getProgram();
    const runCache = cacheFromProgram(program);

    if (lastRunCache != null) {
      const tsSchemaPath = resolve(
        dirname(configPath),
        project.config.tsSchema,
      );
      const ignorePaths = new Set([tsSchemaPath]);
      if (cachesAreEqual(lastRunCache, runCache, ignorePaths)) {
        return;
      }
      reportDiagnostics([
        diagnosticsMessage(
          "File change detected. Starting incremental compilation...",
        ),
      ]);
    }

    lastRunCache = runCache;

    function fixOrReport(diagnostics: ts.Diagnostic[]) {
      if (options.fix && applyFixes(diagnostics, options)) {
        // Watch mode should re-run after applying fixes
        return;
      }
      reportDiagnostics(diagnostics);
    }

    // It's possible our config was updated, so re-read it.
    const configResult = getTsConfig(tsconfig);
    if (configResult.kind === "ERROR") {
      fixOrReport(configResult.err);
      return;
    }
    project = configResult.value.project;
    // For now we just rebuild the schema on every change.
    const schemaResult = buildSchemaAndDocResult(project);
    if (schemaResult.kind === "ERROR") {
      fixOrReport(schemaResult.err);
      return;
    }
    writeSchemaFilesAndReport(schemaResult.value, project, configPath);
  };
  reportDiagnostics([
    diagnosticsMessage("Starting compilation in watch mode..."),
  ]);
  ts.createWatchProgram(watchHost);
}

/**
 * Run the compiler performing a single build.
 */
function runBuild(tsconfig: string, options: BuildOptions) {
  const { project, configPath } = handleDiagnostics(
    withFixesFixed(() => getTsConfig(tsconfig), options),
  );
  const schemaAndDoc = handleDiagnostics(
    withFixesFixed(() => buildSchemaAndDocResult(project), options),
  );
  writeSchemaFilesAndReport(schemaAndDoc, project, configPath);
}

/**
 * Serializes the SDL and TypeScript schema to disk and reports to the console.
 */
function writeSchemaFilesAndReport(
  schemaAndDoc: SchemaAndDoc,
  project: GratsProject,
  configPath: string,
) {
  const gratsConfig: GratsConfig = project.config;

  const dest = resolve(dirname(configPath), gratsConfig.tsSchema);
  const enumsDest =
    gratsConfig.tsClientEnums == null
      ? undefined
      : resolve(dirname(configPath), gratsConfig.tsClientEnums);
  const outputs = printOutputs(schemaAndDoc, gratsConfig, {
    graphqlSchema: true,
    tsSchema: dest,
    tsClientEnums: enumsDest,
    metadata: gratsConfig.EXPERIMENTAL__emitMetadata,
  });

  writeFileSync(dest, nullThrows(outputs.tsSchema));
  console.error(`Grats: Wrote TypeScript schema to \`${dest}\`.`);

  const absOutput = resolve(dirname(configPath), gratsConfig.graphqlSchema);
  writeFileSync(absOutput, nullThrows(outputs.graphqlSchema));
  console.error(`Grats: Wrote schema to \`${absOutput}\`.`);

  if (gratsConfig.EXPERIMENTAL__emitMetadata) {
    const absOutput = resolve(
      dirname(configPath),
      gratsConfig.graphqlSchema.replace(/\.graphql$/, ".json"),
    );
    writeFileSync(absOutput, nullThrows(outputs.metadata));
    console.error(`Grats: Wrote resolver signatures to \`${absOutput}\`.`);
  }

  if (enumsDest != null) {
    writeFileSync(enumsDest, nullThrows(outputs.tsClientEnums));
    console.error(`Grats: Wrote enums module to \`${enumsDest}\`.`);
  }
}

/**
 * Utility function to report diagnostics to the console.
 */
function reportDiagnostics(diagnostics: ts.Diagnostic[]) {
  const reportable = ReportableDiagnostics.fromDiagnostics(diagnostics);
  reportReportableDiagnostics(reportable);
}

function reportReportableDiagnostics(reportable: ReportableDiagnostics) {
  console.error(reportable.formatDiagnosticsWithColorAndContext());
}

/**
 * Utility function to report diagnostics to the console.
 */
function handleDiagnostics<T>(result: DiagnosticsWithoutLocationResult<T>): T {
  if (result.kind === "ERROR") {
    const reportable = ReportableDiagnostics.fromDiagnostics(result.err);
    console.error(reportable.formatDiagnosticsWithColorAndContext());
    process.exit(1);
  }
  return result.value;
}

// Locate and read the tsconfig.json file
function getTsConfig(tsconfig?: string): DiagnosticsWithoutLocationResult<{
  configPath: string;
  project: GratsProject;
}> {
  const cwd = process.cwd();
  const configPath = tsconfig || ts.findConfigFile(cwd, ts.sys.fileExists);
  if (configPath == null) {
    return err([locationlessErr(E.tsConfigNotFound(cwd))]);
  }
  const projectResult = loadProject(configPath);
  if (projectResult.kind === "ERROR") {
    return err(projectResult.err);
  }
  return ok({ configPath, project: projectResult.value });
}

// Format a location for printing to the console. Tools like VS Code and iTerm
// will automatically turn this into a clickable link.
export function formatLoc(loc: Location) {
  return `${loc.source.name}:${loc.startToken.line + 1}:${
    loc.startToken.column + 1
  }`;
}
