# Incremental Migration

This example provides a concrete example of the incremental adoption strategy outlined in our doc "[Schema Merging](../05-guides/02-incremental-migration/01-schema-merging.md)".

**https://github.com/captbaritone/grats/tree/main/examples/incremental-migration/**

While the example is migrating to Grats from Pothos, the approach should be applicable from any solution which emits a `GraphQLSchema` object. This example is presented as a snapshot of a project in the middle of an incremental migration.

## Libraries used

- `graphql-yoga`
- `graphql-js`
- `pothos`
