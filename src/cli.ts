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
import { printGratsSDL, printExecutableSchema } from "./printSchema";
import * as ts from "typescript";
import {
  locationlessErr,
  ReportableDiagnostics,
} from "./utils/DiagnosticError";
import { GratsConfig, ParsedCommandLineGrats } from "./gratsConfig";
import { err, ok, Result } from "./utils/Result";

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
function startWatchMode(tsconfig: string) {
  const { configPath } = handleDiagnostics(getTsConfig(tsconfig));
  const watchHost = ts.createWatchCompilerHost(
    configPath,
    {},
    ts.sys,
    ts.createSemanticDiagnosticsBuilderProgram,
    (diagnostic) => reportDiagnostics([diagnostic]),
    (diagnostic) => reportDiagnostics([diagnostic]),
  );
  watchHost.afterProgramCreate = (program) => {
    // It's possible our config was updated, so re-read it.
    const configResult = getTsConfig(tsconfig);
    if (configResult.kind === "ERROR") {
      reportReportableDiagnostics(configResult.err);
      return;
    }
    const { config } = configResult.value;
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
  const { config, configPath } = handleDiagnostics(getTsConfig(tsconfig));
  const schemaAndDoc = handleDiagnostics(buildSchemaAndDocResult(config));

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
function handleDiagnostics<T>(result: Result<T, ReportableDiagnostics>): T {
  if (result.kind === "ERROR") {
    console.error(result.err.formatDiagnosticsWithColorAndContext());
    process.exit(1);
  }
  return result.value;
}

// Locate and read the tsconfig.json file
function getTsConfig(tsconfig?: string): Result<
  {
    configPath: string;
    config: ParsedCommandLineGrats;
  },
  ReportableDiagnostics
> {
  const cwd = process.cwd();
  const configPath = tsconfig || ts.findConfigFile(cwd, ts.sys.fileExists);
  if (configPath == null) {
    return err(
      ReportableDiagnostics.fromDiagnostics([
        locationlessErr(E.tsConfigNotFound(cwd)),
      ]),
    );
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
