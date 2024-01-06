#!/usr/bin/env node

import { Location } from "graphql";
import { getParsedTsConfig } from "./";
import {
  ConfigOptions,
  ParsedCommandLineGrats,
  SchemaAndDoc,
  buildSchemaAndDocResult,
  extractSchemaAndDoc,
} from "./lib";
import { Command } from "commander";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { version } from "../package.json";
import { locate } from "./Locate";
import { printGratsSDL, printExecutableSchema } from "./printSchema";
import * as ts from "typescript";
import { ReportableDiagnostics } from "./utils/DiagnosticError";

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
  .action(async ({ tsconfig, watch }) => {
    if (watch) {
      startWatchMode(tsconfig);
    } else {
      runBuild(tsconfig);
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
    const { config } = getTsConfigOrReportAndExit(tsconfig);

    const schemaResult = buildSchemaAndDocResult(config);
    if (schemaResult.kind === "ERROR") {
      console.error(schemaResult.err.formatDiagnosticsWithColorAndContext());
      process.exit(1);
    }

    const loc = locate(schemaResult.value.schema, entity);
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
function startWatchMode(tsconfig: string) {
  const { config, configPath } = getTsConfigOrReportAndExit(tsconfig);
  const watchHost = ts.createWatchCompilerHost(
    configPath,
    {},
    ts.sys,
    ts.createSemanticDiagnosticsBuilderProgram,
    (diagnostic) => reportDiagnostics([diagnostic]),
    (diagnostic) => reportDiagnostics([diagnostic]),
  );
  watchHost.afterProgramCreate = (program) => {
    // For now we just rebuild the schema on every change.
    const schemaResult = extractSchemaAndDoc(config, program.getProgram());
    if (schemaResult.kind === "ERROR") {
      reportDiagnostics(schemaResult.err);
      return;
    }
    writeSchemaFilesAndReport(schemaResult.value, config, configPath);
  };
  ts.createWatchProgram(watchHost);
}

/**
 * Run the compiler performing a single build.
 */
function runBuild(tsconfig: string) {
  const { config, configPath } = getTsConfigOrReportAndExit(tsconfig);
  const schemaResult = buildSchemaAndDocResult(config);
  if (schemaResult.kind === "ERROR") {
    console.error(schemaResult.err.formatDiagnosticsWithColorAndContext());
    process.exit(1);
  }

  writeSchemaFilesAndReport(schemaResult.value, config, configPath);
}

/**
 * Serializes the SDL and TypeScript schema to disk and reports to the console.
 */
function writeSchemaFilesAndReport(
  schemaAndDoc: SchemaAndDoc,
  config: ParsedCommandLineGrats,
  configPath: string,
) {
  const { schema, doc } = schemaAndDoc;

  const gratsOptions: ConfigOptions = config.raw.grats;

  const dest = resolve(dirname(configPath), gratsOptions.tsSchema);
  const code = printExecutableSchema(schema, gratsOptions, dest);
  writeFileSync(dest, code);
  console.error(`Grats: Wrote TypeScript schema to \`${dest}\`.`);

  const schemaStr = printGratsSDL(doc, gratsOptions);

  const absOutput = resolve(dirname(configPath), gratsOptions.graphqlSchema);
  writeFileSync(absOutput, schemaStr);
  console.error(`Grats: Wrote schema to \`${absOutput}\`.`);
}

/**
 * Utility function to report diagnostics to the console.
 */
function reportDiagnostics(diagnostics: ts.Diagnostic[]) {
  const reportable = ReportableDiagnostics.fromDiagnostics(diagnostics);
  console.error(reportable.formatDiagnosticsWithColorAndContext());
}

// Locate and read the tsconfig.json file
function getTsConfigOrReportAndExit(tsconfig?: string): {
  configPath: string;
  config: ParsedCommandLineGrats;
} {
  const configPath =
    tsconfig || ts.findConfigFile(process.cwd(), ts.sys.fileExists);
  if (configPath == null) {
    throw new Error("Grats: Could not find tsconfig.json");
  }
  const optionsResult = getParsedTsConfig(configPath);
  if (optionsResult.kind === "ERROR") {
    console.error(optionsResult.err.formatDiagnosticsWithColorAndContext());
    process.exit(1);
  }
  return { configPath, config: optionsResult.value };
}

// Format a location for printing to the console. Tools like VS Code and iTerm
// will automatically turn this into a clickable link.
export function formatLoc(loc: Location) {
  return `${loc.source.name}:${loc.startToken.line + 1}:${
    loc.startToken.column + 1
  }`;
}
