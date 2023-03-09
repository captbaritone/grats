import { printSchema } from "graphql";
import { buildSchema } from ".";

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
  const schema = await buildSchema(glob);
  console.log(printSchema(schema));
}

main();
