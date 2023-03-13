#!/usr/bin/env node

import { printSchema } from "graphql";
import { buildSchema } from ".";
import DiagnosticError from "./utils/DiagnosticError";

/**
 * Build a schema from a glob pattern.
 *
 * Usage: node dist/cli.js "./**.ts"
 */
async function main() {
  const glob = process.argv[2];
  if (!glob) {
    throw new Error("Expected glob as first argument");
  }
  try {
    const schema = await buildSchema(glob);
    console.log(printSchema(schema));
  } catch (e) {
    if (e.loc) {
      console.log(DiagnosticError.prototype.asCodeFrame.call(e));
      process.exit(1);
    } else {
      throw e;
    }
  }
}

main();
