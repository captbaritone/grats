# Docblock Tags

In order for Grats to extract GraphQL schema from your code, simply mark which TypeScript structures should be included in the schema by marking them with special JSDoc tags such as `/** @gqlType */` or `/** @gqlField */`.

:::caution
JSDocs must being with `/**` (two asterisk). However, they may be consolidated into a single line `/** Like this */`.
:::

:::info

- To learn about comment syntax, see [Comment Syntax](../01-getting-started/04-comment-syntax.md)
- To learn _why_ Grats uses comments, see [Why Use Comments](../06-faq/02-why-use-comments.md)

:::

Each tag maps directly to a concept in the GraphQL [Schema Definition Language](https://graphql.org/learn/schema/) (SDL). The following JSDoc tags are supported:

- [`@gqlType`](./01-types.mdx)
- [`@gqlField`](./02-fields.mdx)
  - [Root fields](./02-root-fields.mdx)
  - [Arguments](./03-arguments.mdx)
  - [Context](./04-context.mdx)
  - [Info](./04-info.mdx)
- [`@gqlInterface`](./05-interfaces.mdx)
- [`@gqlUnion`](./06-unions.mdx)
- [`@gqlEnum`](./07-enums.mdx)
- [`@gqlScalar`](./08-scalars.mdx)
- [`@gqlInput`](./09-inputs.mdx)
  - [`@oneOf`](./10-oneof-inputs.mdx)

:::tip
This documentation aims to be complete, but our hope is that you feel empowered to just slap one of these docblock tags on the relevant TypeScript class/type/method/etc in your code, and let Grats' helpful error messages guide you.
:::
