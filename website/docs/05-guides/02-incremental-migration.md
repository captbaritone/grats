# Incremental Migration

## From Schema-First with GraphQL-JS

If your current implementation uses your schema document as the source of truth
and you are using [GraphQL-js](https://www.npmjs.com/package/graphql) as your
JavaScript executor, a very nice incremental adoption strategy is possible.

### Gradually annotate

First, begin adding Grats docblock to your code, adding your types, fields,
etc. You can do as little or as much as you want at a time. Since Grats
annotations have no runtime affect, these changes are trivially safe to add.
Note that you may uncover places where your types are not explicit enough for
Grats. In these cases you may need additional annotations, or explicit
definitions for types which were previously implicit.

After adding a batch of annotations you can run Grats to see if it has uncovered
any errors:

```bash
npx grats
```

### Validate

As you start to get close to having all of your types and fields annotated, you
can use graphql-schema-diff to compare the schema Grats extracts with your
existing schema:

```bash
npx grats
npx graphql-schema-diff --fail-on-all-changes --sort-schema path/to/existing/schema.gql ./grats-schema.gql
```

This should give you a todo list of types that sill need annotations, or places
where names/types don't perfectly align.

### Use Grats' schema

Once there are no remaining meaningful differences, you can simply delete your
old schema and use Grats' schema SDL and generate TypeScript executable schema instead.

At this point you may want to add some CI step to ensure that any changes to
your code that result in schema changes are committed. See the
[Workflows](./01-workflows.md) guide for more details.
