# How Grats Works

_This is a technical deep dive for those who are curious about how Grats works under the hood. You do not need to read this document in order to use Grats. For a user-centric description of how Grats works see [How it works](../01-getting-started/index.mdx#how-it-works) in our welcome doc._

---

For users who want to have a better mental model of how Grats works, or just for the curious, here's a high level overview of how Grats is implemented. For a description of Grats' values and aspirations, see [Design Principles](./06-design-principles.md). For thoughts on its API design, see [Why Use Comments?](./02-why-use-comments.md).

Grats is written in Rust. The `grats` CLI is a native binary, and the same code is compiled to WebAssembly to power our [playground](/playground). It parses your TypeScript code with [oxc](https://oxc.rs), and it uses a Rust port of the parts of [`graphql-js`](https://graphql.org/graphql-js/) that it needs to represent, validate and print GraphQL schemas.

## At build time

### Extraction

When statically analyzing your code to infer GraphQL schema, Grats first looks for your `tsconfig.json`. From there it finds all the TypeScript files your config includes, along with every file they import. Imports are resolved the way a bundler would resolve them. Grats does not run the TypeScript compiler, so these are the only source files it reads. Each one is parsed with oxc.

Grats then checks each of these files to see if it contains any `@gql*` tags. If it does, Grats will iterate over every `@gql*` tag in the file. For each tag it finds that maps to a top-level GraphQL construct (type, interface, etc.), it finds the AST node to which that comment is attached, following the same rules TypeScript uses to attach JSDoc comments to code. Now that Grats has an AST node and an expectation of what GraphQL construct it's trying to infer, it tries all the different inference strategies it has available to it. If it can't infer a GraphQL construct, it will report a diagnostic error to the user. That sounds a lot fancier than what the code looks like: a series of `match` expressions and `if` statements.

If it's able to infer a GraphQL construct, it will build up a GraphQL AST node representing the schema definition. In the case of `@gqlType` or similar, this may mean inspecting child elements of the AST node for child constructs like `@gqlField` and recursively inspecting those nodes.

Where a type annotation references a type by name, Grats follows that name to its declaration, including across imports, to find out which GraphQL type it refers to. Grats does this itself, using oxc's semantic analysis to resolve names within a file, rather than asking TypeScript's type checker.

These GraphQL AST nodes are the shape that `graphql-js` builds when it parses a GraphQL SDL file, and thus can be used with Grats' port of `graphql-js`' utilities. However, we play a few clever tricks:

When we construct the location information for each GraphQL AST node, which would usually point into the Schema Definition Language (SDL) text from which it was parsed, we instead point it at the TypeScript AST node: the file it is in and its position within that file.

By building up these AST nodes, Grats is able to use the same validation logic that `graphql-js` uses to validate GraphQL schemas to validate Grats' inferred schema. And because we have populated the location information with the TypeScript AST node, the diagnostics we get from that validation will actually "point" to the TypeScript source code that Grats uses as the source of truth for that AST node. You can read more about this technique in [this note](https://jordaneldredge.com/notes/compile-to-ast/).

One final trick: Grats prints its diagnostics in the same format as TypeScript's error printer, so Grats' errors look just like the TypeScript errors you are already used to.

In a few cases, like when a field name does not match its property/method name, Grats tracks this fact by annotating some AST objects with additional properties. These allow other phases of Grats to see additional information. When all transformations are complete, the remaining metadata is collected into a single `Metadata` object that is passed to the codegen phase. We are currently experimenting with allowing Grats to optionally output this metadata as a JSON file for use by other tools.

### TypeScript code generation

With the GraphQL AST in hand, Grats must now generate TypeScript code that will construct your `GraphQLSchema` at runtime. To do this, Grats uses the AST to construct a schema object in memory. This normalized representation of the schema, with all extensions merged and all types in a flat list, is then passed to a codegen function that recursively walks the schema and generates TypeScript code for each type.

The implementation of each field's `resolve` function is synthesized based on information about that field in the `Metadata` object. In some cases that means importing user-defined resolver functions.

To implement our code generation, we again lean into our [design principle](./06-design-principles.md#a-few-dependencies-well-leveraged) of "a few dependencies well leveraged" by building a TypeScript AST with oxc's AST builder. We then use oxc's code generator to emit a formatted TypeScript file. By constructing a TypeScript AST rather than simply concatenating strings, we get a few benefits:

1. Confidence that our generated code will be syntactically valid TypeScript.
2. Automatic formatting of the generated code.

### GraphQL SDL code generation

To generate the GraphQL SDL file, Grats prints the same GraphQL AST using its port of `graphql-js`' `print` function.

## At runtime

At runtime Grats is not involved at all. The generated TypeScript code is just a module that exports a function which builds your `GraphQLSchema` object using `graphql-js`. It does not use any Grats code at runtime. In addition, we avoid needing to parse the GraphQL SDL at runtime, which can be a significant performance improvement, especially at the edge or in the browser.
