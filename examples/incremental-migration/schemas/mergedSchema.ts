import { schema as legacySchema } from "./pothosSchema.js";
import { getSchema as getGratsSchema } from "./gratsGeneratedSchema.js";
import { mergeSchemas } from "@graphql-tools/schema";
import { printSchema, lexicographicSortSchema } from "graphql";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Merges the Pothos (legacy) and Grats (new) schemas into a single schema for
 * use at runtime. It then sorts the schema and writes the file to disk in the
 * project's root directory.
 */

export const schema = mergeSchemas({
  schemas: [legacySchema, getGratsSchema()],
});

// Sort the schema to ensure stable output when written to disk
const SDL = printSchema(lexicographicSortSchema(schema));
// Note: This script will be in `dist` when it runs.
const schemaPath = path.join(__dirname, "../../schema.graphql");
fs.writeFileSync(schemaPath, SDL);
