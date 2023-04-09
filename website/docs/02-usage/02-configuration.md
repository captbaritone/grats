# Configuration

Grats has a few configuration options. They can be set in your project's
`tsconfig.json` file:

```json
{
  "grats": {
    // Should all fields be typed as nullable in accordance with GraphQL best
    // practices?
    // https://graphql.org/learn/best-practices/#nullability
    // 
    // Individual fileds can declare themselves as nonnullable by adding the
    // docblock tag `@killsParentOnException`.
    "nullableByDefault": true, // Default: true

    // Should Grats error if it encounters a TypeScript type error?
    // Note that Grats will always error if it encounters a TypeScript syntax
    // error.
    "reportTypeScriptTypeErrors": false, // Default: false
  },
  "compilerOptions": {
    // ... TypeScript config...
  }
}
```