# Grats Incremental Migration from Pothos

This is an example repo demonstrating an incremental migration strategy. While the example used here is migrating from Pothos, the approach should be applicable from any solution which emits a `GraphQLSchema` object.

You can read more about this approach in the Grats docs: https://grats.capt.dev/guides/incremental-migration/schema-merging

This example is presented as a snapshot of a project in the middle of an incremental migration. So far, the following fields have been migrated to Grats and commented out from the Pothos schema.

- `Query.user`
- `User.firstName`
- `User.lastName`
- `User.fullName`
- `User.id`

## Points of interest

- `./schemas/mergedSchema.ts` Simple script to merge the Pothos and Grats schemas. Writes the merged schema to `./schema.graphq`.
- `./schemas/pothosSchema.ts` The original schema. A few fields have been migrated and are commented out.
- `./models.ts` Contains model/data classes used by Pothos. Annotations and functions are being added here to add fields to Grats.

## Running the demo

- `$ pnpm install`
- `$ pnpm run schema` Runs Grats and generates a merged schema.
- `$ pnpm run start`
