#!/usr/bin/env node

import { printSchema } from "graphql";
import { buildSchemaResult } from "./lib";
import { glob } from "glob";

/**
 * Build a schema from a glob pattern.
 *
 * Usage: node dist/cli.js "./**.ts"
 */
async function main() {
  const pattern = process.argv[2];
  if (!pattern) {
    throw new Error("Expected glob as first argument");
  }
  const files = await glob(pattern);
  const schemaResult = buildSchemaResult({ files });
  if (schemaResult.kind === "ERROR") {
    console.error(schemaResult.err.formatDiagnosticsWithColorAndContext());
    process.exit(1);
  } else {
    console.log(printSchema(schemaResult.value));
  }
}

main();
