# Changelog

## Next (UNRELEASED)

Changes in this section are not yet released. If you need access to these changes before we cut a release, check out our `@main` NPM releases. Each commit on the main branch is [published to NPM](https://www.npmjs.com/package/grats?activeTab=versions) under the `main` tag.

### Grats is now written in Rust

Grats has been rewritten in Rust. The `grats` CLI is now a native binary, which parses your code with [oxc](https://oxc.rs) rather than running the TypeScript compiler, and it's much faster:

| Project                                                                                                         | Wall time                  | Peak memory                   |
| --------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------- |
| [`examples/production-app`](https://github.com/captbaritone/grats/tree/main/examples/production-app) (18 files) | 0.82 s → 0.06 s (14× less) | 380 MB → 44 MB (8.6× less)    |
| 10,000 generated files                                                                                          | 6.1 s → 0.9 s (6.6× less)  | 1.79 GB → 0.82 GB (2.2× less) |

_Wall time and peak memory of 0.0.36's CLI compared with the current one, both run as you'd run them — the `grats` command, Node wrapper and all — on Node 24 on an M1 Pro MacBook Pro. Medians of repeated runs against a warm file cache. The generated project is the one `pnpm run profile` creates._

_Most of what's left on `production-app` is the wrapper starting Node: the binary itself finishes in 0.02 s. Small projects are dominated by startup, so the larger the project, the more of the schema extraction itself you're measuring._

We ported Grats one file at a time, and checked every step against its existing test suite: 480 snapshot tests, which record the schema, code, errors and fixes Grats produces for an input, 29 integration tests, which run queries against the generated schema, and the 75 examples in these docs. The Rust implementation passes all of them, and the only snapshot changes are formatting and the error-report changes listed below.

So, for the same code, Grats extracts the same schema and generates the same code with slightly different formatting. **For most projects, upgrading is just a matter of regenerating, and committing a formatting-only diff.** But no longer being a JavaScript program built on TypeScript does change how Grats is distributed and which files it reads, so check the breaking changes below.

### Breaking changes

**Grats is a native binary.** The npm package includes prebuilt binaries for macOS, Linux and Windows. Grats' JavaScript APIs are all gone, along with the experimental TypeScript language service plugin: the package now only exports the types Grats projects import, like `Int` and `Float`.

**Grats no longer runs TypeScript.** Grats reads your code itself, so it no longer does what TypeScript would:

- **No type checking.** The `reportTypeScriptTypeErrors` option is removed, so run `tsc` to report type errors. Grats still reports syntax errors, but their wording differs from TypeScript's.
- **Only included and imported files are read.** Grats reads the files your `tsconfig.json` includes and the files they import. Files TypeScript would pull in some other way, like through `/// <reference>` directives or automatically included `@types` packages, are no longer read.
- **Merges with built-in interfaces aren't reported.** Grats doesn't read TypeScript's built-in declarations, so it can no longer report a `@gqlInterface` or `@gqlInput` interface which merges with a built-in one, like the DOM's `Node`.
- **Imports are resolved like a bundler would.** Grats ignores `moduleResolution` and the options related to it.
- **Inherited file lists are relative to your `tsconfig.json`.** `files`, `include` and `exclude` inherited through `extends` are relative to your config, rather than to the config which sets them.
- **`include` and `exclude` patterns are matched a little differently.** They're case sensitive, support `[...]` and `{a,b}`, and wildcards never match `node_modules` or names starting with `.`.

If any of these changes cause problems for your project, please [file an issue](https://github.com/captbaritone/grats/issues) so we can look into it.

### Other changes

- **Features**
  - Added support for deriving `@gqlEnum` from const arrays (`(typeof X)[number]`) and const objects (`(typeof X)[keyof typeof X]`). This allows defining enums with runtime-accessible values without using TypeScript's `enum` syntax. The const declaration must immediately precede the type alias. See [enum docs](../04-docblock-tags/07-enums.mdx#runtime-accessible-enums) for details.
  - Values of `@gqlEnum`s defined as a union of string literals or a const array can now have descriptions, `@deprecated` and `@gqlAnnotate` tags, using a docblock before each value. Previously, since TypeScript doesn't attach docblocks to them, descriptions and `@deprecated` were silently ignored and `@gqlAnnotate` was reported as a detached docblock. See [enum docs](../04-docblock-tags/07-enums.mdx) for details.
- **Improvements**
  - `typescript` is now a peer dependency (`>=5.5`) rather than a dependency, so Grats no longer installs its own copy of TypeScript. ([PR](https://github.com/captbaritone/grats/pull/228))
  - Grats' types support TypeScript 6.0. ([PR](https://github.com/captbaritone/grats/pull/228))
  - Output files which can't be written are now reported as errors, rather than crashing the CLI.
  - Errors in the arguments of `@gqlAnnotate` directives now point to the argument in your docblock, rather than to a `GraphQL request` copy of the directive. Syntax errors in `@gqlAnnotate` and `@gqlDirective` tags now point to the invalid text rather than to the whole tag.
  - With `strictSemanticNullability` enabled, defining your own `@semanticNonNull` directive is now reported at your definition, rather than at a `GraphQL request` copy of Grats' definition.
  - Errors about the name given in a tag, like `@gqlType Name`, now point to the text after the tag rather than to the whole tag.
  - The fix which replaces `@specifiedBy` with `@gqlAnnotate` now escapes quotes and backslashes in the URL, and no longer joins the closing `*/` onto the tag's line.
  - Projects without any GraphQL types now get an error explaining how to define one, rather than an empty schema. Grats always meant to report this, but the check never fired.
  - Two different generic type instantiations which Grats would give the same name, like `Pair<AB, C>` and `Pair<A, BC>` (both `ABCPair`), are now reported as an error. Previously, one silently used the other's type.
  - Generic types which pass their type parameter to another generic type after a concrete type argument, like `pair: Pair<User, T>`, are now supported. Previously, they were reported as an invalid type parameter.
  - Generic types which reference themselves with more deeply nested type arguments, like `children: Tree<Tree<T>>`, are now reported as an error. Previously, Grats crashed.
  - Errors in generic types are now reported once, rather than once for each combination of type arguments the type is used with.
  - Type parameters are now only considered used in a GraphQL position if the generic types they're passed to use theirs in one. So, passing a type parameter to a generic type which ignores it no longer requires a GraphQL type argument, and types whose type parameters are only passed between each other, like `type Foo<T> = { bar: Bar<T> }` and `type Bar<T> = { foo: Foo<T> }`, are no longer generic. Previously, Grats named such types after their type arguments, like `BazFoo`.
  - The error for an interface field which is semantically non-null on the interface but nullable on an implementor now names the interface field as the one expecting a non-nullable type. Previously, the two field names were swapped.
  - `--fix` no longer corrupts the file when removing a tag that is repeated more than twice in the same docblock. Previously, each removal was applied once per duplicate.
  - When a comment Grats cannot use contains multiple Grats tags on separate lines, each error now points to its own tag. Previously, errors for tags after the first pointed to the first tag.
  - With `EXPERIMENTAL__emitMetadata`, if `graphqlSchema` doesn't end in `.graphql`, the metadata is now written to its path with `.json` appended. Previously, it overwrote the GraphQL schema.
  - The fix which adds `public` to a `@gqlField` constructor parameter marked `override` now puts `public` before `override`. Previously, it produced `override public`, which TypeScript rejects.

## 0.0.36

- **Breaking Changes**
  - Grats is now published as an ES module. If you were importing Grats using `require()`, you will need to switch to `import` or use a dynamic `import()`.
- **Features**
  - The Grats npm package now includes an `llm-docs/` directory containing agent-friendly Markdown documentation. AI coding agents can use these docs to understand Grats' API and conventions without needing to access the website.

## 0.0.35

- **Features**
  - Added support for async derived context functions. Derived context functions can now return `Promise<T>` and Grats will automatically generate the necessary `await` expressions in resolver code.
  - Added support for `readonly T[]` as parsable GraphQL types.
  - Added support for literal `boolean` and `string` types in output positions. A field returning `true` will be typed as `Boolean`, and `"hello"` as `String`.

## 0.0.34

- **Features**
  - Added [`--fix`](../01-getting-started/02-cli.md#automatic-fixes) flag to automatically fix fixable diagnostics. The CLI can now automatically apply fixes for common issues like incorrect casing in docblock tags and deprecated tag usage. The `--fix` flag works with both single builds and watch mode.
  - Built-in support for serialization/parsing of custom scalars. Grats' generated `getSchema` function now requires a config object which can include serialization/parsing functions for any custom scalars defined in your schema. See [the docs](https://grats.capt.dev/docs/docblock-tags/scalars/#serialization-and-parsing-of-custom-scalars) for details.
  - Added [`tsClientEnums`](../01-getting-started/03-configuration.mdx#tsClientEnums) configuration option. When `tsClientEnums` is set, Grats will generate a TypeScript module containing all your GraphQL enum types as TypeScript enums for reuse in your client code.

- **Performance**
  - We've added tooling for measuring and analyzing Grats' performance. This highlighted a number of optimization opportunities resulting in a ~20% reduction in build time for large schemas:
    - [Performance improvements](https://github.com/graphql/graphql-js/pull/4312) from upgrading `graphql-js` to `v16.11.0`. ([PR](https://github.com/captbaritone/grats/pull/194))
    - Improved performance from more careful use of `graphql-js`'s visitor API. ([PR](https://github.com/captbaritone/grats/pull/193))
    - Replaced some instances of `graphql-js`'s `visit()` with simpler functions. ([PR](https://github.com/captbaritone/grats/pull/196))

- **Improvements**
  - Fixed watch mode issue where each build would write `schema.ts` which would trigger a second build.
  - Watch mode now responds changes to the Grats config.
  - The error message which appears when no types are defined has been improved to allow schemas with any type (not just object types). This validation now also runs in watch mode to provide consistency with non-watch mode.
  - Minor improvements to error messages.
  - A blank line has been added after the headers in Grats' generated files.
  - Grats now uses TypeScript v5.9.2 which should prevent errors when using TypeScript config options only available in newer versions.
  - Grats now uses `graphql` v16.11.0 which includes a number of performance improvements.

- **Bug Fixes**
  - Don't remove built-in directives in exported `GraphQLSchema` when custom directives are defined. ([PR](https://github.com/captbaritone/grats/pull/191)).
  - Fix crash when a non-GraphQL type parameter is used before a GraphQL type parameter in a generic GraphQL type.

## 0.0.33

- **Improvements**
  - Added support for `@gqlUnion`s with only one member
  - String literals used as enum values in argument defaults are modeled as enums in the generated schema, not strings.
  - TypeScript enum values used as argument defaults are now supported.
  - Added testing to confirm support for Node 22 and 23.
  - Added support for aliased directive arguments with default values to enable arguments that are keywords in TypeScript.

## 0.0.32

This version introduces support for [defining directives](../04-docblock-tags/11-directive-definitions.mdx), and [annotating](../04-docblock-tags/12-directive-annotations.mdx) your schema with directives.

- **Breaking Changes**
  - The docblock tag `@specifiedBy` has been removed in favor of `@gqlAnnotate` which allows you to generically add directives to GraphQL schema constructs.
    - Replace `@specifiedBy http://example.com` with `@gqlAnnotate specifiedBy(url: "http://example.com")`
  - The docblock tag `@oneOf` has been removed and Grats will now infer it.

- **Improvements**
  - Remove superfluous argument name property from `schema.ts`
  - Generated `GraphQLSchema` now includes the `specifiedByURL` property for custom scalars that use the `@specifiedBy` directive.

## 0.0.31

Grats now supports [Derived Context Values](https://grats.capt.dev/docs/docblock-tags/context/#derived-context-values). These allow you to define a function which returns a different context value than the one root context provided by your main GraphQL server. It could be a fully unique value, or something derived from your root context.

Once defined, any resolver can define an argument typed using the derived resolver's function's return type, Grats will be able to provide that argument, just like it can provide the root context value.

```ts
/** @gqlContext */
type Ctx = { db: DB };

/** @gqlContext */
export function getDb(ctx: Ctx): DB {
  return ctx.db;
}

/**
 * A field which reads a derived context. Grats will invoke the above `getDb`
 * function and pass it to this resolver function.
 *
 * @gqlQueryField */
export function me(db: DB): string {
  return db.selectUser().name;
}
```

## 0.0.30

### Root Field Tags

Fields on `Query`, `Mutation` and `Subscription` may now be defined using the new docblock tags `@gqlQueryField`, `@gqlMutationField` and `@gqlSubscriptionField`. These tags can be added to functions or static methods.

```typescript
/** @gqlQueryField */
export function greeting(): string {
  return "Hello world";
}
```

- **Features**
  - Custom error messages when types or interfaces are missing fields which suggests adding a `@gqlField` docblock tag.
  - Custom error message when your project has no types defined. Intended to help guide new users.
- **Improvements**
  - Better import deduplication in generated TypeScript code

## 0.0.29

- **Bug Fixes**
  - Include `semver` as dependency in `package.json` which was accidentally only included as a dev dependency.

## 0.0.28

Version `0.0.28` comes with a number of new features and should not have any breaking changes relative to `0.0.27`. The new features:

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
