# Docblock Tags

In order for Grats to extract GraphQL schema from your code, simply mark which TypeScript structures should be included in the schema by marking them with special JSDoc tags such as `/** @gqlType */` or `/** @gqlField */`.

> **CAUTION:**
> JSDocs must being with `/**` (two asterisk). However, they may be consolidated into a single line `/** Like this */`.

> **INFO:**
> -   To learn about comment syntax, see [Comment Syntax](./getting-started/comment-syntax.md)
> -   To learn _why_ Grats uses comments, see [Why Use Comments](./faq/why-use-comments.md)

Each tag maps directly to a concept in the GraphQL [Schema Definition Language](https://graphql.org/learn/schema/) (SDL). The following JSDoc tags are supported:

-   [`@gqlType`](./docblock-tags/types.md)
-   [`@gqlField`](./docblock-tags/fields.md)
    -   [Root fields](./docblock-tags/root-fields.md)
    -   [Arguments](./docblock-tags/arguments.md)
    -   [Context](./docblock-tags/context.md)
    -   [Info](./docblock-tags/info.md)
-   [`@gqlInterface`](./docblock-tags/interfaces.md)
-   [`@gqlUnion`](./docblock-tags/unions.md)
-   [`@gqlEnum`](./docblock-tags/enums.md)
-   [`@gqlScalar`](./docblock-tags/scalars.md)
-   [`@gqlInput`](./docblock-tags/inputs.md)
    -   [`@oneOf`](./docblock-tags/oneof-inputs.md)

> **TIP:**
> This documentation aims to be complete, but our hope is that you feel empowered to just slap one of these docblock tags on the relevant TypeScript class/type/method/etc in your code, and let Grats' helpful error messages guide you.
