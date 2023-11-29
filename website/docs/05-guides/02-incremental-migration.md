# Incremental Migration

## From Schema-First with GraphQL-JS

If your current implementiaton uses your schema document as the source of truth
and you are using [GraphQL-js](https://www.npmjs.com/package/graphql) as your
JavaScript executor, a very nice incremental adoption strategy is possible.

### Gradually annotate

First, begin adding Grats docblocks to your code, adding your types, fields,
etc. You can do as little or as much as you want at a time. Since Grats
annotaitons have no runtime affect, these changes are trivially safe to add.
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
npx grats --output=./grats-schema.gql
npx graphql-schema-diff --fail-on-all-changes --sort-schema path/to/existing/schema.gql ./grats-schema.gql
```

This should give you a todo list of types that sill need annotations, or places
where names/types don't perfectly align.

### Use Grat's schema

Once there are no remaining meaningful differences, you can simply replace your
old schema with Grat's derived one! You don't even need to use Grats at runtime.

```bash
npx grats --output=path/to/existing/schema.gql
```

At this point you may want to add some CI step to ensure that any changes to
your code that result in schema changes are committed. See the
[Workflows](./01-workflows.md) guide for more details.

### Migrate

In order to take advantage of Grats' runtime features, such as field renaming or
functional field resolvers, you will need to use Grats at runtime. You can get a
`graphql-js` `GraphQLSchema` object for your schema by calling Grats'
`buildSchemaFromSDL` function:

```typescript
import * as express from "express";
import { graphqlHTTP } from "express-graphql";
import { buildSchemaFromSDL } from "grats";
import { readFileSync } from "fs";

const app = express();

const sdl = readFileSync("./grats-schema.graphql", "utf8");
const schema = buildSchemaFromSDL(sdl);

app.use("/graphql", graphqlHTTP({ schema: schema, graphiql: true }));
app.listen(4000);
console.log("Running a GraphQL API server at http://localhost:4000/graphql");
```
