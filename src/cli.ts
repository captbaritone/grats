#!/usr/bin/env node

import { GraphQLSchema, Location, lexicographicSortSchema } from "graphql";
import { getParsedTsConfig } from "./";
import {
  ConfigOptions,
  ParsedCommandLineGrats,
  buildSchemaResult,
} from "./lib";
import { Command } from "commander";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { version } from "../package.json";
import { locate } from "./Locate";
import { printGratsSDL, printExecutableSchema } from "./printSchema";
import * as ts from "typescript";

const program = new Command();

program
  .name("grats")
  .description("Extract GraphQL schema from your TypeScript project")
  .version(version)
  .option(
    "--tsconfig <TSCONFIG>",
    "Path to tsconfig.json. Defaults to auto-detecting based on the current working directory",
  )
  .action(async ({ tsconfig }) => {
    build(tsconfig);
  });

program
  .command("locate")
  .argument("<ENTITY>", "GraphQL entity to locate. E.g. `User` or `User.id`")
  .option(
    "--tsconfig <TSCONFIG>",
    "Path to tsconfig.json. Defaults to auto-detecting based on the current working directory",
  )
  .action((entity, { tsconfig }) => {
    const { config } = getTsConfig(tsconfig);

    const schema = buildSchema(config);
    const loc = locate(schema, entity);
    if (loc.kind === "ERROR") {
      console.error(loc.err);
      process.exit(1);
    }
    console.log(formatLoc(loc.value));
  });

program.parse();

function build(tsconfig?: string) {
  const { config, configPath } = getTsConfig(tsconfig);
  const schema = buildSchema(config);
  const sortedSchema = lexicographicSortSchema(schema);

  const gratsOptions: ConfigOptions = config.raw.grats;

  const dest = resolve(dirname(configPath), gratsOptions.tsSchema);
  const code = printExecutableSchema(sortedSchema, gratsOptions, dest);
  writeFileSync(dest, code);
  console.error(`Grats: Wrote TypeScript schema to \`${dest}\`.`);

  const schemaStr = printGratsSDL(sortedSchema, gratsOptions);

  const absOutput = resolve(dirname(configPath), gratsOptions.graphqlSchema);
  writeFileSync(absOutput, schemaStr);
  console.error(`Grats: Wrote schema to \`${absOutput}\`.`);
}

// Locate and read the tsconfig.json file
function getTsConfig(tsconfig?: string): {
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

function buildSchema(options: ParsedCommandLineGrats): GraphQLSchema {
  const schemaResult = buildSchemaResult(options);
  if (schemaResult.kind === "ERROR") {
    console.error(schemaResult.err.formatDiagnosticsWithColorAndContext());
    process.exit(1);
  }

  return schemaResult.value;
}

// Format a location for printing to the console. Tools like VS Code and iTerm
// will automatically turn this into a clickable link.
export function formatLoc(loc: Location) {
  return `${loc.source.name}:${loc.startToken.line + 1}:${
    loc.startToken.column + 1
  }`;
}
