#!/usr/bin/env node

import { printSchema } from "graphql";
import { buildSchema } from ".";
import DiagnosticError from "./utils/DiagnosticError";
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
  try {
    const files = await glob(pattern);
    const schema = buildSchema({ files });
    console.log(printSchema(schema));
  } catch (e) {
    if (e.loc) {
      console.error(
        DiagnosticError.prototype.formatWithColorAndContext.call(e),
      );
      process.exit(1);
    } else {
      throw e;
    }
  }
}

main();
