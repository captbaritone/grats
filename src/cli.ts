#!/usr/bin/env node

import { printSchema } from "graphql";
import { getParsedTsConfig, gratsOptionsFromTsConfig } from "./";
import { buildSchemaResult } from "./lib";

/**
 * Extract schema from TypeScript files and print to stdout.
 *
 * Will search for a tsconfig.json file relative to the current working
 * directory.
 *
 * There are not yet any command line options.
 *
 * Usage: grats
 */
async function main() {
  const parsed = getParsedTsConfig();
  // FIXME: Validate config!
  // https://github.com/tsconfig/bases
  const schemaResult = buildSchemaResult(gratsOptionsFromTsConfig(parsed));
  if (schemaResult.kind === "ERROR") {
    console.error(schemaResult.err.formatDiagnosticsWithColorAndContext());
    process.exit(1);
  } else {
    console.log(printSchema(schemaResult.value));
  }
}

main();
