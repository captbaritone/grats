# Configuration

Grats has a few configuration options. They can be set under the `grats` key in your in your project's `tsconfig.json` file:

:::warning
TypeScript does not include user-defined config options when processing the [`extends`](https://www.typescriptlang.org/tsconfig/#extends) config option. If you are using `extends` in your `tsconfig.json`, you will need to copy the `grats` config into each final extending `tsconfig.json` file.
:::

```json
{
  "grats": {
    // Where Grats should write your schema file. Path is relative to
    // `tsconfig.json`.
    "graphqlSchema": "./schema.graphql", // Defaults to `./schema.graphql`

    // Where Grats should write your executable TypeScript schema file. Path is
    // relative to `tsconfig.json`.
    "tsSchema": "./schema.ts", // Defaults to `./schema.ts`

    // Should all fields be typed as nullable in accordance with GraphQL best
    // practices?
    // https://graphql.org/learn/best-practices/#nullability
    //
    // Individual fields can declare themselves as non-nullable by adding the
    // docblock tag `@killsParentOnException`.
    "nullableByDefault": true, // Default: true

    // Experimental feature to add `@semanticNonNull` to all fields which have
    // non-null TypeScript return types, but which are made nullable by the
    // `nullableByDefault` option.
    //
    // This feature allows clients which handle errors out of band, for example
    // by discarding responses with errors, to know which fields are expected to
    // be non-null in the absence of errors.
    //
    // See https://grats.capt.dev/docs/guides/strict-semantic-nullability
    //
    // It is an error to enable `semanticNullability` if `nullableByDefault` is
    // false.
    "strictSemanticNullability": false, // Default: false

    // Should Grats error if it encounters a TypeScript type error?
    // Note that Grats will always error if it encounters a TypeScript syntax
    // error.
    "reportTypeScriptTypeErrors": false, // Default: false

    // A string to prepend to the generated schema text. Useful for copyright
    // headers or other information to the generated file. You may also pass an array
    // of strings. These strings will be joined together.
    //
    // Set to `null` to omit the default header.
    "schemaHeader": "# Copyright SomeCorp, 1998...", // Defaults to info about Grats

    // A string to prepend to the generated TypeScript schema file. Useful for copyright
    // headers or other information to the generated file. You may also pass an array
    // of strings. These strings will be joined together.
    //
    // Set to `null` to omit the default header.
    "tsSchemaHeader": "/** Copyright SomeCorp, 1998...", // Defaults to info about Grats

    // This option allows you configure an extension that will be appended
    // to the end of all import paths in the generated TypeScript schema file.
    // When building a package that uses ES modules, import paths must not omit the
    // file extension. In TypeScript code this generally means import paths must end
    // with `.js`. If set to null, no ending will be appended.
    "importModuleSpecifierEnding": ".js" // Defaults to no ending, or ""
  },
  "compilerOptions": {
    // ... TypeScript config...
  }
}
```
