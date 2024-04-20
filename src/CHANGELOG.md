# Grats Changelog

## Next (UNRELEASED)

Changes in this section are not yet released. If you need access to these changes before we cut a release, check out our `@main` NPM releases. Each commit on the main branch is [published to NPM](https://www.npmjs.com/package/grats?activeTab=versions) under the `main` tag.

- **Features**
  - Code actions are now available to automatically fix some errors. These are available in the playground as well as in the experimental TypeScript plugin
  - We now require that `__typename = "SomeType"` include `as const` to ensure no other typename can be assigned. A code fix is available
  - Fields can now be defined using static methods, similar to how fields can be defined using functions
  - Adds `importModuleSpecifierEnding` configuration option to enable users generating ES modules to add the `.js` file extension to import paths in the generated TypeScript schema file
- **Bug Fixes**
  - Revert accidental breakage of the experimental TypeScript plugin
  - Fix a bug where we generated incorrect import paths on Windows

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
