#!/usr/bin/env node

import { lexicographicSortSchema } from "graphql";
import { getParsedTsConfig } from "./";
import { buildSchemaResult } from "./lib";
import { printSchemaWithDirectives } from "@graphql-tools/utils";

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
  const schemaResult = buildSchemaResult(parsed);
  if (schemaResult.kind === "ERROR") {
    console.error(schemaResult.err.formatDiagnosticsWithColorAndContext());
    process.exit(1);
  } else {
    const schema = lexicographicSortSchema(schemaResult.value);
    console.log(printSchemaWithDirectives(schema, { assumeValid: true }));
  }
}

main();
