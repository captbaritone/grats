# API Overview

In order for Grats to extract GraphQL schema from your code, simply mark which
TypeScript structures should be included in the schema by marking them with
special JSDoc tags such as `/** @gqlType */` or `/** @gqlField */`.

:::caution
JSDocs must being with `/**` (two asterix). However, they may be consolidated into a single line `/** Like this */`.
:::

Each tag maps directly to a concept in the GraphQL [Schema Definition Language](https://graphql.org/learn/schema/) (SDL).  The following JSDoc tags are supported:

* [`@gqlType`](./02-dockblock-tags/01-types.mdx)
* [`@gqlInterface`](./02-dockblock-tags/04-interfaces.mdx)
* [`@gqlField`](./02-dockblock-tags/02-fields.mdx)
* [`@gqlUnion`](./02-dockblock-tags/05-unions.mdx)
* [`@gqlScalar`](./02-dockblock-tags/06-scalars.mdx)
* [`@gqlEnum`](./02-dockblock-tags/07-enums.mdx)
* [`@gqlInput`](./02-dockblock-tags/08-inputs.mdx)


:::tip
This documentaiton aims
to be complete, but our hope is that you feel empowered to just slap one of
these docblock tags on the relevent TypeScript class/type/method/etc in your
code, and let Grats' helpful error messages guide you.
:::
