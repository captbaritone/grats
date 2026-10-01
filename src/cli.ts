#!/usr/bin/env node

// LLM agent docs: See the llm-docs/ directory in the package root for
// Markdown documentation covering all Grats features and configuration.

import { buildSchemaAndDocResult } from "./lib.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as ts from "typescript";
import {
  GratsDiagnostic,
  ReportableDiagnostics,
  DiagnosticsWithoutLocationResult,
} from "./utils/DiagnosticError.js";
import { loadProject } from "./rs/project.js";
import { applyFixes, runCli, writeSchemaFiles } from "./rs/cli.js";
import { cacheFromProgram, cachesAreEqual, RunCache } from "./runCache.js";

type WatchOptions = { fix: boolean };

// A made-up error code that we use to fake a TypeScript error code.
// We pick a very random number to avoid collisions with real error messages.
const FAKE_ERROR_CODE = 1038;

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

const outcome = runCli(process.argv.slice(2), version);
if (outcome.kind === "watch") {
  startWatchMode(outcome.tsconfig ?? undefined, { fix: outcome.fix });
} else {
  process.exitCode = outcome.code;
}

/**
 * Run the compiler in watch mode.
 */
function startWatchMode(tsconfig: string | undefined, options: WatchOptions) {
  // Config errors are never fixable.
  const configInfo = handleDiagnostics(loadProject(tsconfig));
  const { configPath } = configInfo;
  let project = configInfo.project;
  const watchHost = ts.createWatchCompilerHost(
    configPath,
    {},
    ts.sys,
    ts.createSemanticDiagnosticsBuilderProgram,
    (diagnostic) => reportTsDiagnostics([diagnostic]),
    (diagnostic) => {
      // Some messages we handle ourselves since we ignore some updates. e.g.
      // when we observe a change we ourselves created.
      switch (diagnostic.code) {
        case 6031: // Starting compilation in watch mode...
        case 6032: // File change detected. Starting incremental compilation...
          return;
        default:
          reportTsDiagnostics([diagnostic]);
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
      reportTsDiagnostics([
        diagnosticsMessage(
          "File change detected. Starting incremental compilation...",
        ),
      ]);
    }

    lastRunCache = runCache;

    function fixOrReport(diagnostics: GratsDiagnostic[]) {
      if (options.fix && applyFixes(diagnostics, { log: console.error })) {
        // Watch mode should re-run after applying fixes
        return;
      }
      reportDiagnostics(diagnostics);
    }

    // It's possible our config was updated, so re-read it.
    const configResult = loadProject(tsconfig);
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
    const writeResult = writeSchemaFiles(
      schemaResult.value.doc,
      project.config,
      configPath,
    );
    if (writeResult.kind === "ERROR") {
      reportDiagnostics(writeResult.err);
    }
  };
  reportTsDiagnostics([
    diagnosticsMessage("Starting compilation in watch mode..."),
  ]);
  ts.createWatchProgram(watchHost);
}

/**
 * Utility function to report diagnostics to the console.
 */
function reportDiagnostics(diagnostics: GratsDiagnostic[]) {
  const reportable = ReportableDiagnostics.fromDiagnostics(diagnostics);
  console.error(reportable.formatDiagnosticsWithColorAndContext());
}

/**
 * Utility function to report diagnostics to the console.
 */
function handleDiagnostics<T>(result: DiagnosticsWithoutLocationResult<T>): T {
  if (result.kind === "ERROR") {
    reportDiagnostics(result.err);
    process.exit(1);
  }
  return result.value;
}

function diagnosticsMessage(messageText: string): ts.Diagnostic {
  return {
    file: undefined,
    start: undefined,
    length: undefined,
    messageText,
    category: ts.DiagnosticCategory.Message,
    source: "Grats",
    code: FAKE_ERROR_CODE,
  };
}

/**
 * Reports watch mode's messages, and those of TypeScript's watch program.
 */
function reportTsDiagnostics(diagnostics: ts.Diagnostic[]) {
  const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (path) => path,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine,
  });
  // TypeScript requires having an error code, but we are not a real TS error,
  // so we don't have an error code. This little hack here is a sin, but it
  // lets us leverage all of TypeScript's error reporting logic.
  console.error(
    formatted.replace(new RegExp(` TS${FAKE_ERROR_CODE}: `, "g"), ": "),
  );
}
