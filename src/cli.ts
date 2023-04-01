#!/usr/bin/env node

import { lexicographicSortSchema } from "graphql";
import { getParsedTsConfig } from "./";
import { buildSchemaResult } from "./lib";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { Command } from "commander";
import { writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { version } from "../package.json";

const program = new Command();

program
  .name("grats")
  .description("Extract GraphQL schema from your TypeScript project")
  .version(version)
  .option(
    "-o, --output <SCHEMA_FILE>",
    "Where to write the schema file. Defaults to stdout",
  )
  .option(
    "--tsconfig <TSCONFIG>",
    "Path to tsconfig.json. Defaults to auto-detecting based on the current working directory",
  )
  .action(async ({ output, tsconfig }) => {
    build(output, tsconfig);
  });

program.parse();

function build(output: string, tsconfig?: string) {
  if (tsconfig && !existsSync(tsconfig)) {
    console.error(`Grats: Could not find tsconfig.json at \`${tsconfig}\`.`);
    process.exit(1);
  }
  const parsed = getParsedTsConfig(tsconfig);
  // FIXME: Validate config!
  // https://github.com/tsconfig/bases
  const schemaResult = buildSchemaResult(parsed);
  if (schemaResult.kind === "ERROR") {
    console.error(schemaResult.err.formatDiagnosticsWithColorAndContext());
    process.exit(1);
  }
  const schema = lexicographicSortSchema(schemaResult.value);
  const schemaStr = printSchemaWithDirectives(schema, { assumeValid: true });
  if (output) {
    const absOutput = resolve(process.cwd(), output);
    writeFileSync(absOutput, schemaStr);
    console.error(`Grats: Wrote schema to \`${absOutput}\`.`);
  } else {
    console.log(schemaStr);
  }
}
