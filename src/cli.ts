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
  .action(async ({ tsconfig }) => build(tsconfig));

program
  .command("locate")
  .argument("<ENTITY>", "GraphQL entity to locate. E.g. `User` or `User.id`")
  .option(
    "--tsconfig <TSCONFIG>",
    "Path to tsconfig.json. Defaults to auto-detecting based on the current working directory",
  )
  .action((entity, { tsconfig }) => {
    const optionsResult = getParsedTsConfig(tsconfig);
    if (optionsResult.kind === "ERROR") {
      throw new Error("TODO");
    }
    const options = optionsResult.value;

    const schema = buildSchema(options);
    const loc = locate(schema, entity);
    if (loc.kind === "ERROR") {
      console.error(loc.err);
      process.exit(1);
    }
    console.log(formatLoc(loc.value));
  });

program.parse();

async function build(tsconfig?: string): Promise<void> {
  const configFile =
    tsconfig || ts.findConfigFile(process.cwd(), ts.sys.fileExists);
  if (configFile == null) {
    throw new Error("Grats: Could not find tsconfig.json");
  }
  const optionsResult = getParsedTsConfig(configFile);
  if (optionsResult.kind === "ERROR") {
    console.error(optionsResult.err.formatDiagnosticsWithColorAndContext());
    process.exit(1);
  }
  const options = optionsResult.value;
  const config: ConfigOptions = options.raw.grats;
  const schema = buildSchema(options);

  const dest = resolve(dirname(configFile), config.tsSchema);
  const code = printExecutableSchema(schema, config, dest);
  writeFileSync(dest, await formatWithPrettier(code, dest, "typescript"));
  console.info(`Grats: Wrote TypeScript schema to \`${dest}\`.`);

  const sortedSchema = lexicographicSortSchema(schema);
  const schemaStr = printGratsSDL(sortedSchema, config);

  const absOutput = resolve(dirname(configFile), config.graphqlSchema);

  writeFileSync(
    absOutput,
    await formatWithPrettier(schemaStr, absOutput, "graphql"),
  );

  console.info(`Grats: Wrote schema to \`${absOutput}\`.`);
}

async function formatWithPrettier(
  code: string,
  absOutputFilename?: string,
  parser: "typescript" | "graphql" = "typescript",
): Promise<string> {
  const prettier = await import("prettier").catch(() => undefined);
  if (!prettier) {
    console.warn("`Prettier` is not importable");
    return code;
  }

  const options =
    absOutputFilename && (await prettier.resolveConfig(absOutputFilename));
  if (!options) {
    console.info(
      "Could not resolve Prettier config.",
      absOutputFilename ? `Skipping formatting of ${absOutputFilename}` : "",
    );
    return code;
  }

  options.parser = parser;
  return prettier.format(code, options);
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
