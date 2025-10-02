#!/usr/bin/env node

import * as E from "./Errors";
import { Location } from "graphql";
import { getParsedTsConfig } from "./";
import {
  SchemaAndDoc,
  buildSchemaAndDocResult,
  extractSchemaAndDoc,
} from "./lib";
import { Command } from "commander";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { version } from "../package.json";
import { locate } from "./Locate";
import {
  printGratsSDL,
  printExecutableSchema,
  printEnumsModule,
} from "./printSchema";
import * as ts from "typescript";
import {
  diagnosticsMessage,
  locationlessErr,
  ReportableDiagnostics,
  DiagnosticsWithoutLocationResult,
} from "./utils/DiagnosticError";
import { GratsConfig, ParsedCommandLineGrats } from "./gratsConfig";
import { err, ok } from "./utils/Result";
import { cacheFromProgram, cachesAreEqual, RunCache } from "./runCache";
import { withFixesFixed, FixOptions, applyFixes } from "./fixFixable";

type BuildOptions = FixOptions;

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
    const { config } = handleDiagnostics(getTsConfig(tsconfig));

    const { schema } = handleDiagnostics(buildSchemaAndDocResult(config));

    const loc = locate(schema, entity);
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
  let config = configInfo.config;
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
        config.raw.grats.tsSchema,
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
    config = configResult.value.config;
    // For now we just rebuild the schema on every change.
    const schemaResult = extractSchemaAndDoc(config, program);
    if (schemaResult.kind === "ERROR") {
      fixOrReport(schemaResult.err);
      return;
    }
    writeSchemaFilesAndReport(schemaResult.value, config, configPath);
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
  const { config, configPath } = handleDiagnostics(
    withFixesFixed(() => getTsConfig(tsconfig), options),
  );
  const schemaAndDoc = handleDiagnostics(
    withFixesFixed(() => buildSchemaAndDocResult(config), options),
  );
  writeSchemaFilesAndReport(schemaAndDoc, config, configPath);
}

/**
 * Serializes the SDL and TypeScript schema to disk and reports to the console.
 */
function writeSchemaFilesAndReport(
  schemaAndDoc: SchemaAndDoc,
  config: ParsedCommandLineGrats,
  configPath: string,
) {
  const { schema, doc, resolvers } = schemaAndDoc;

  const gratsConfig: GratsConfig = config.raw.grats;

  const dest = resolve(dirname(configPath), gratsConfig.tsSchema);
  const code = printExecutableSchema(schema, resolvers, gratsConfig, dest);
  writeFileSync(dest, code);
  console.error(`Grats: Wrote TypeScript schema to \`${dest}\`.`);

  const schemaStr = printGratsSDL(doc, gratsConfig);

  const absOutput = resolve(dirname(configPath), gratsConfig.graphqlSchema);
  writeFileSync(absOutput, schemaStr);
  console.error(`Grats: Wrote schema to \`${absOutput}\`.`);

  if (config.raw.grats.EXPERIMENTAL__emitMetadata) {
    const absOutput = resolve(
      dirname(configPath),
      gratsConfig.graphqlSchema.replace(/\.graphql$/, ".json"),
    );
    writeFileSync(absOutput, JSON.stringify(resolvers, null, 2));
    console.error(`Grats: Wrote resolver signatures to \`${absOutput}\`.`);
  }

  if (config.raw.grats.EXPERIMENTAL__emitEnums != null) {
    const absOutput = resolve(
      dirname(configPath),
      config.raw.grats.EXPERIMENTAL__emitEnums,
    );
    const enumCode = printEnumsModule(schema, gratsConfig, absOutput);
    writeFileSync(absOutput, enumCode);
    console.error(`Grats: Wrote enums module to \`${absOutput}\`.`);
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
  config: ParsedCommandLineGrats;
}> {
  const cwd = process.cwd();
  const configPath = tsconfig || ts.findConfigFile(cwd, ts.sys.fileExists);
  if (configPath == null) {
    return err([locationlessErr(E.tsConfigNotFound(cwd))]);
  }
  const optionsResult = getParsedTsConfig(configPath);
  if (optionsResult.kind === "ERROR") {
    return err(optionsResult.err);
  }
  return ok({ configPath, config: optionsResult.value });
}

// Format a location for printing to the console. Tools like VS Code and iTerm
// will automatically turn this into a clickable link.
export function formatLoc(loc: Location) {
  return `${loc.source.name}:${loc.startToken.line + 1}:${
    loc.startToken.column + 1
  }`;
}
