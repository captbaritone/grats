# Schema Merging

:::tip
A concrete example of this migration strategy in action can be found in our [Incremental Migration](../../05-examples/index.mdx) example app.
:::

One incremental approach to migrating to Grats is Schema Merging. With this approach you allow your legacy solution and Grats to each create their own `GraphQLSchema` object. You then merge these two schemas together to create a new merged schema that includes both the existing schema and the Grats schema.

The Grats schema starts out empty, and you can incrementally add types and fields to it, deleting them from the legacy schema (or not!) as you go.

Types in the two schemas with the same name will be merged together, with the type in the merged schema containing all fields from both schemas. By allowing both schemas to independently define the same type, it becomes possible to migrate at a field granularity. In other words, you can migrate a single field to the Grats schema while leaving all other fields on the legacy schema.

One key advantage of this approach, is that it can be tested and deployed incrementally. There is no hard cut-over and each incremental step can can be validated locally and in production.

## Setup schema merging

In this approach we will assume that both your existing schema and Grats will each create their own `GraphQLSchema` object. We will then merge these two schemas together to create a new schema that includes both the existing schema and the Grats schema.

We will use the [`mergeSchemas`](https://the-guild.dev/graphql/tools/docs/schema-merging) function from `@graphql-tools/schema` to merge the two schemas together.

```
npm install @graphql-tools/schema
```

```ts title="/mergedSchema.ts"
import legacySchema from "./legacySchema";
import { getSchema } from "./schema.ts"; // Grats' generated schema file
import { mergeSchemas } from "@graphql-tools/schema";
import { printSchema, lexicographicSortSchema } from "graphql";
import fs from "fs";
import path from "path";

/**
 * Merges the legacy and Grats (new) schemas into a single schema for use at
 * runtime. It then sorts the schema and writes the file to disk in the
 * project's root directory.
 */

const unsortedMergedSchema = mergeSchemas({
  schemas: [legacySchema, getSchema()],
});

export const schema = unsortedMergedSchema;

// Sort the schema to ensure stable output when written to disk
const SDL = printSchema(lexicographicSortSchema(schema));
// Note: This script will be in `dist` when it runs.
const schemaPath = path.join(__dirname, "../mergedSchema.graphql");
fs.writeFileSync(schemaPath, SDL);
```

When running Grats, this script should also be run. One approach might look like:

```json title="/package.json"
{
  // ...
  "scripts": {
    "grats": "grats && tsc && node dist/mergedSchema.js"
  }
  // ...
}
```

## Workflow

Once the infrastructure for the migration is in place, here is what migration might look like:

1. Select a field to migrate
2. Ensure its parent type has been annotated with a docblock
3. Annotate the selected field. This may require:
   1. Adding type annotations or extracting the logic into a function or method
   2. Annotating any used input or return types
4. Delete the field from the legacy implementation
5. Test the migrated field to ensure it still works as expected
6. Commit and deploy the change to production
7. Repeat...

## Completion

Once the final field on the final type has been migrated, the legacy schema's library can be uninstalled, and the script used to merge schemas may be deleted leaving Grats as the sole source of truth.

## Get in touch

This approach and associated workflow has been validated in a small demo app, but not in a large production app. If you take on a migration using this approach, please get in touch in the [Grats Discord server](https://capt.dev/grats-chat). We would love to help you problem solve any issues you encounter, and update this document to include any issues or tricks you uncover.
