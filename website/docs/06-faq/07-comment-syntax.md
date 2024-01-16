# Comment Syntax

Grats uses docblock comments to annotate which declarations in your code should be exposed in your GraphQL schema. Using comments to annotate code like this is unusual and can be confusing at first. This document explains how to use docblocks correctly, but Grats itself also aims to be helpful and will warn you if it encounters a docblock that it doesn't understand or is used improperly.

:::info
To learn more about _why_ Grats uses docblock comments, see the page [Why Use Comments](./02-why-use-comments.md).
:::

In broad strokes, Grats looks for docblocks with special `@gql` tags and uses the position of those docblocks to infer the declaration to which they apply.

## JSDoc

Grats only looks for tags in [JSDoc](https://jsdoc.app/) docblocks. JSDoc is a standard syntax for annotating JavaScript code with metadata and is used by many tools, including [TypeScript](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html).

JSDoc docblocks are defined as block comments that begin with `/**`.

> Each comment must start with a `/**` sequence in order to be recognized by the JSDoc parser. Comments beginning with `/*`, `/***`, or more than 3 stars will be ignored. This is a feature to allow you to suppress parsing of comment blocks.

&mdash; [JSDoc Documentation](https://jsdoc.app/about-getting-started)

This means the following comments will _not_ be recognized by Grats:

```
// @gqlType
/* @gqlType */
```

## Tag Syntax

Tags in docblocks

## Attachment

In order to determine which declaration a comment applies to, Grats leverage's the TypeScript compiler to determine which TypeScript declaration a comment is referencing. This is known as "comment attachment". Comment attachment is a surprisingly complex problem, with edge cases that don't always feel intuitive. But in general, the TypeScript compiler will attach a comment to the declaration that directly follows it.

If Grats encounters a `@gql` comment that does not seem to be attached to _any_ declaration, it will report an error. Similarly, if Grats encounters a `@gql` comment that is attached to a declaration that is incompatible with the tag used, it will report an error.
