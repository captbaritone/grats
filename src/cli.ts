#!/usr/bin/env node

import * as E from "./Errors";
import { GraphQLNamedType, GraphQLObjectType, Location, parse } from "graphql";
import { getParsedTsConfig } from "./";
import {
  SchemaAndDoc,
  buildSchemaAndDocResult,
  extractSchemaAndDoc,
} from "./lib";
import { Command } from "commander";
import { writeFileSync } from "fs";
import { resolve, dirname, join } from "node:path";
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
import * as fs from "fs";
import { resolverMapCodegen } from "./codegen/resolverMapCodegen";
import { filterMetadata, extractUsedFields } from "./constructUsedMetadata";

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

    const { schema } = handleDiagnostics(buildSchemaAndDocResultForCli(config));

    const loc = locate(schema, entity);
    if (loc.kind === "ERROR") {
      console.error(loc.err);
      process.exit(1);
    }
    console.log(formatLoc(loc.value));
  });

program
  .command("persist")
  .argument("<OPERATION_TEXT>", "Text of the GraphQL operation to persist")
  .option(
    "--tsconfig <TSCONFIG>",
    "Path to tsconfig.json. Defaults to auto-detecting based on the current working directory",
  )
  .action((operationText, { tsconfig }) => {
    const { config, configPath } = handleDiagnostics(getTsConfig(tsconfig));

    const schemaAndDocResult = buildSchemaAndDocResult(config);
    if (schemaAndDocResult.kind === "ERROR") {
      console.error(
        schemaAndDocResult.err.formatDiagnosticsWithColorAndContext(),
      );
      process.exit(1);
    }

    const { schema, resolvers } = schemaAndDocResult.value;

    if (operationText === "-") {
      operationText = fs.readFileSync(0, "utf-8");
    }

    // TODO: Turn parse errors into diagnostics.
    const doc = parse(operationText, { noLocation: true });

    if (doc.definitions.some((def) => def.kind !== "OperationDefinition")) {
      // TODO: Diagnostics?
      throw new Error("Expected all definitions to be operations.");
    }

    const name = "placeholder_name";

    const destDir = resolve(dirname(configPath), `./persisted`);
    const dest = join(destDir, `${name}.ts`);

    const usedResolverMap = extractUsedFields(schema, doc);

    const newResolverMap = filterMetadata(usedResolverMap, resolvers);

    const result = resolverMapCodegen(
      schema,
      newResolverMap,
      config.raw.grats,
      dest,
    );

    fs.mkdirSync(destDir, { recursive: true });
    writeFileSync(dest, result);
    console.error(`Grats: Wrote TypeScript operation to \`${dest}\`.`);
  });

program.parse();

/**
 * Run the compiler in watch mode.
 */
function startWatchMode(tsconfig: string) {
  const { config, configPath } = handleDiagnostics(getTsConfig(tsconfig));
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

function isUserDefinedType(type: GraphQLNamedType): boolean {
  return type instanceof GraphQLObjectType && !type.name.startsWith("__");
}

/**
 * Like `buildSchemaAndDocResult` but applies a few additional validations that
 * are considered helpful for CLI usage, like warning if you have no types defined..
 */

function buildSchemaAndDocResultForCli(
  config: ParsedCommandLineGrats,
): Result<SchemaAndDoc, ReportableDiagnostics> {
  const result = buildSchemaAndDocResult(config);
  if (result.kind === "ERROR") {
    return result;
  }
  const types = Object.values(result.value.schema.getTypeMap());
  if (!types.some((t) => isUserDefinedType(t))) {
    return err(
      ReportableDiagnostics.fromDiagnostics([
        locationlessErr(E.noTypesDefined()),
      ]),
    );
  }

  return result;
}

/**
 * Run the compiler performing a single build.
 */
function runBuild(tsconfig: string) {
  const { config, configPath } = handleDiagnostics(getTsConfig(tsconfig));
  const schemaAndDoc = handleDiagnostics(buildSchemaAndDocResultForCli(config));

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
