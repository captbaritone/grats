# Grats Changelog

## Next (UNRELEASED)

Changes in this section are not yet released. If you need access to these changes before we cut a release, check out our `@main` NPM releases. Each commit on the main branch is [published to NPM](https://www.npmjs.com/package/grats?activeTab=versions) under the `main` tag.

### Positional Arguments

Field arguments can now be defined using regular TypeScript arguments rather requiring all GraphQL arguments to be grouped together in a single object.

```ts
/** @gqlType */
class Query {
  /** @gqlField */
  userById(_: Query, id: string): User {
    return DB.getUserById(id);
  }
}
```

The improved ergonomics of this approach are especially evident when defining arguments with default values:

```ts
/** @gqlType */
class Query {
  // OLD STYLE
  /** @gqlField */
  greeting(_: Query, { salutation = "Hello" }: { salutation: string }): string {
    return `${salutation} World`;
  }

  // NEW STYLE
  /** @gqlField */
  greeting(_: Query, salutation: string = "Hello"): string {
    return `${salutation} World`;
  }
}
```

### Arrow function fields

Fields can now be defined using arrow functions:

```ts
/** @gqlField */
export const userById = (_: Query, id: string): User => {
  return DB.getUserById(id);
};
```

### Backtick strings

Backtick strings are now correctly parsed as strings literals, as long as they are not used as template strings. For example `\`Hello\`` in the following example:

```ts
/** @gqlType */
class Query {
  /** @gqlField */
  greeting(_: Query, salutation: string = `Hello`): string {
    return `${salutation} World`;
  }
}
```

## 0.0.27

Version `0.0.27` comes with a number of new features as well as some minor breaking changes.

- **Breaking**
  - Resolver parameters `args`, `context`, and `info` may now be used in any order, and are all optional. To enable this flexibility there are three small breaking changes, all of which will be reported with helpful errors when you run `grats` [#143](https://github.com/captbaritone/grats/pull/147):
    - The declaration of the type/class you use as your GraphQL context must now be annotated with `@gqlContext` to be recognized by Grats.
    - If you access the `info` object in a resolver, you must type it using `GqlInfo` exported from `grats`.
    - Unused `args` and `context` resolver parameters must now be omitted instead of being typed as `unknown`.
- **Features**
  - If a `@gqlType` which is used in an abstract type is defined using an exported `class`, an explicit `__typename` property is no-longer required. Grats can now generate code to infer the `__typename` based on the class definition. [#144](https://github.com/captbaritone/grats/pull/144)
  - Support for [`@oneOf`](https://grats.capt.dev/docs/docblock-tags/oneof-inputs) on input types. This allows you to define a discriminated union of input types. [#146](https://github.com/captbaritone/grats/pull/146)
- **Bug Fixes**
  - The experimental TypeScript plugin will now report a diagnostics if it encounters a TypeScript version mismatch. [#143](https://github.com/captbaritone/grats/pull/143)

## 0.0.26

- **Features**
  - Code actions are now available to automatically fix some errors. These are available in the playground as well as in the experimental TypeScript plugin
  - We now require that `__typename = "SomeType"` include `as const` to ensure no other typename can be assigned. A code fix is available
  - Fields can now be defined using static methods, similar to how fields can be defined using functions
  - Adds `importModuleSpecifierEnding` configuration option to enable users generating ES modules to add the `.js` file extension to import paths in the generated TypeScript schema file
- **Bug Fixes**
  - Reverted accidental breakage of the experimental TypeScript plugin
  - Fixed a bug where we generated incorrect import paths on Windows
  - Fixed a bug where incorrect resolver arguments were passed to method resolvers which provided custom names

## 0.0.25

- **Features**

  - Support for defining types using [generics](https://grats.capt.dev/docs/resolvers/generics/)

- **Documentation**
  - An [extensive example app](https://grats.capt.dev/docs/examples/production-app/) showing many patterns used in a production app

## 0.0.24

- **Features**
  - Support for [`@specifiedBy`](https://grats.capt.dev/docs/docblock-tags/scalars/#specifiedby-directive) on custom scalars
  - Allow non-subscription fields to return `AsyncIterable` to [enable `@stream`](https://grats.capt.dev/docs/guides/stream/)

## 0.0.23

- **Features**
  - Allow an arg to be optional and not nullable if a default is provided
  - Improve validation of config options

## The Before Time

Before `0.0.23` release we don't have detailed changelogs.
