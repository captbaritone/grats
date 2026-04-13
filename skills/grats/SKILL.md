---
name: grats
description: Build GraphQL servers by annotating TypeScript code with docblock tags like @gqlType and @gqlField. Use when writing, reviewing, or refactoring GraphQL resolvers in a project that uses Grats, or when the user mentions Grats, @gqlType, @gqlField, or similar docblock tags.
license: MIT
metadata:
  author: grats
  version: "1.0.0"
---

# Grats

Grats extracts a GraphQL schema from TypeScript code. Instead of writing a separate schema file, you annotate your TypeScript types and functions with docblock tags like `/** @gqlType */` and `/** @gqlField */`. Grats then generates an executable GraphQL schema and a `.graphql` file as a build step.

## Documentation

Grats ships comprehensive documentation in its npm package at `node_modules/grats/llm-docs/`. Read these files for detailed reference:

- **Getting started**: `node_modules/grats/llm-docs/getting-started/quick-start.md`
- **All docblock tags**: `node_modules/grats/llm-docs/docblock-tags.md`
- **Resolver patterns**: `node_modules/grats/llm-docs/resolvers.md`
- **Configuration**: `node_modules/grats/llm-docs/getting-started/configuration.md`
- **CLI usage**: `node_modules/grats/llm-docs/getting-started/cli.md`

## How to Write Grats Code

Write idiomatic TypeScript — classes, type aliases, interfaces, functions — whatever style suits the project. Then add docblock tags (`/** @gqlType */`, `/** @gqlField */`, etc.) to the constructs you want to expose in the GraphQL schema. Grats infers the GraphQL meaning from your TypeScript types. If something is ambiguous or incorrect, Grats will give you a helpful error message telling you how to fix it.

You do not need to learn a specific pattern or DSL. Just write the TypeScript code that feels natural and annotate it. Grats supports classes, interfaces, type aliases, functions, static methods, and more — use whatever fits.

Annotate the project's existing model types and data classes directly rather than creating a separate "resolver" layer with new wrapper types. Grats is designed to work with your real domain types — add `@gqlType` and `@gqlField` to the types you already have.

### Docblock Tags

Each tag maps directly to a GraphQL schema construct. Tags must use `/**` (two asterisks).

| Tag                     | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `@gqlType`              | Define a GraphQL object type                   |
| `@gqlField`             | Define a field on a type                       |
| `@gqlQueryField`        | Define a field on the root `Query` type        |
| `@gqlMutationField`     | Define a field on the root `Mutation` type     |
| `@gqlSubscriptionField` | Define a field on the root `Subscription` type |
| `@gqlInterface`         | Define a GraphQL interface                     |
| `@gqlUnion`             | Define a GraphQL union                         |
| `@gqlEnum`              | Define a GraphQL enum                          |
| `@gqlScalar`            | Define a custom GraphQL scalar                 |
| `@gqlInput`             | Define a GraphQL input type                    |
| `@gqlContext`           | Mark a type as the GraphQL context object      |

For detailed documentation on each tag, read the files in `node_modules/grats/llm-docs/docblock-tags/`.

### Configuration

Grats is configured under the `"grats"` key in `tsconfig.json`:

```json
{
  "grats": {
    "nullableByDefault": true,
    "importModuleSpecifierEnding": ".js"
  }
}
```

For all options, read `node_modules/grats/llm-docs/getting-started/configuration.md`.

### Running Grats

```bash
npx grats          # Generate schema
npx grats --watch  # Watch mode
npx grats --fix    # Auto-fix common issues
```

Rerun Grats after any change that is expected to modify the GraphQL schema (adding or changing types, fields, arguments, etc.) to regenerate the schema files.

The project may have its own script or workflow for running Grats (e.g., an npm script, a build step, or a watch task). Check the project's `package.json` scripts and documentation first, and defer to the project's approach if one exists.

### Working with Generated Files

Grats generates `schema.ts` and `schema.graphql`. These files should be **committed to the repository** — they are expected to be checked in so that schema changes are visible in code review and accessible to other tools. Do not add them to `.gitignore`.

Do not manually edit generated files or run autoformatters on them. If CI fails with a "schema out of date" error, rerun Grats and commit the updated files.

For more details, read `node_modules/grats/llm-docs/guides/workflows.md`.

## Things You Might Not Expect

- **All fields are nullable by default** per GraphQL best practices — `string` produces `String`, not `String!`. Prefer keeping fields nullable. `@killsParentOnException` can make a field non-null, but use it with caution: if the resolver throws, the error propagates up and nulls out the nearest nullable parent, increasing the blast radius. For projects that want clients to see which fields are _expected_ to be non-null absent errors, enable `strictSemanticNullability` in the Grats config. See `node_modules/grats/llm-docs/resolvers/nullability.md` and `node_modules/grats/llm-docs/guides/strict-semantic-nullability.md`.
- **Root types are auto-created.** `@gqlQueryField` automatically creates the `Query` type — you don't need to define it separately. See `node_modules/grats/llm-docs/docblock-tags/root-fields.md`.
- **`@deprecated` JSDoc tag auto-maps** to the GraphQL `@deprecated` directive. No need for `@gqlAnnotate`. See `node_modules/grats/llm-docs/resolvers/deprecated.md`.
- **Generics are supported.** `Connection<User>` auto-materializes as `UserConnection` in the schema. See `node_modules/grats/llm-docs/guides/generics.md`.
- **Derived context values** enable dependency injection: a function annotated with `@gqlContext` that takes the root context and returns a new type creates an injectable value. See `node_modules/grats/llm-docs/docblock-tags/context.md`.

## Additional Documentation

For advanced topics, read the files in `node_modules/grats/llm-docs/`:

- **Guides**: `guides/` — subscriptions, dataloader, generics, incremental migration, workflows, permissions, connection spec
- **FAQ**: `faq/` — design principles, limitations, how Grats works
- **Examples**: `examples/` — Apollo Server, Yoga, Next.js, production app patterns
