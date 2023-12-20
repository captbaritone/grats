# How Grats Works

_This is a technical deep dive for those who are curious about how Grats works under the hood. You do not need to read this document in order to use Grats. For a user-centric description of how Grats works see [How it works](../01-getting-started/index.mdx#how-it-works) in our welcome doc._

---

For users who want to have a better mental model of how Grats works, or just for the curious, here's a high level overview of how Grats is implemented. For a description of Grats' values and aspirations, see [Design Principles](./04-design-principles.md).

## At build time

### Extraction

When statically analyzing your code to infer GraphQL schema, grats first looks for your TypeScript config. From there it's able to ask the TypeScript compiler for all all the TypeScript files in your project, as well as the right configuration options to pass to the TypeScript compiler.

Grats then iterates over these files and checks via Regex to see if they contain any `@gql*` tags. If they do, Grats will parse the file and iterate over every `@gql*` tag. For each tag it finds that maps to a top-level GraphQL construct (type, interface, etc.), it asks the TypeScript compiler for the AST node to which that comment is attached. Now that Grats has an AST node and an expectation of what GraphQL construct it's trying to infer, it tries all the different inference strategies it has available to it. If it can't infer a GraphQL construct, it will report a diagnostic error to the user. That sounds a lot fancier than what the code looks like: a series of switch and if statements.

If it's able to infer a GraphQL construct, it will build up a GraphQL AST node representing the schema definition. In the case of `@gqlType` or similar, this may mean inspecting child elements of the AST node for child constructs like `@gqlField` and recursively inspecting those nodes. These GraphQL AST nodes are the exact shape the [`graphql-js`](https://graphql.org/graphql-js/) builds when it parses a GraphQL SDL file, and thus are API-compatible with `graphql-js` utilities. However, we play one clever trick. When we construct the location information for each GraphQL AST node, which would usually contain the line and column number of the Schema Definition Language (SDL) text from which it was parsed, we instead use the location information from the TypeScript AST node, including its file path, line number, and column number.

By building up these AST nodes, Grats is able to use the same code that `graphql-js` uses to validate GraphQL schema to validate Grats' inferred schema. And because we have populated the location information with the TypeScript AST node, the diagnostics we get from `graphql-js` will actually "point" the the TypeScript source code that Grats uses as the source of truth for that AST node. You can read more about this technique in [this note](https://jordaneldredge.com/notes/compile-to-ast/).

One final trick we employ is using TypeScript's representation of a diagnostic. This allows us to use TypeScript's error printer for free.

In a few cases, like when a field name does not match its property/method name, Grats tracks this fact by annotating some constructs with custom server directives. These allow the extraction phase of Grats to communicate additional information to the codegen phase of Grats. Since these directives are an implementation detail of Grats, they are not included in the generated SDL. You can think of the annotated SDL AST as an internal [intermediate representation](https://en.wikipedia.org/wiki/Intermediate_representation) (IR) used by Grats.

### TypeScript code generation

With the GraphQL AST in hand, Grats must now generate TypeScript code that will construct your `GraphQLSchema` at runtime. To do this, Grats uses the AST to constructs a `GraphQLSchema` object in memory. This normalized representation of the schema, with all extensions merged and all types in a flat list, is then passed to a codegen function that recursively walks the schema and generates TypeScript code for each type.

The implementation of each field's `resolve` function is synthesized based on which IR directives are encountered on that field. In some cases that means importing user-defined resolver functions.

To implement our code generation, we again lean into our [design principle](./04-design-principles.md#a-few-dependencies-well-leveraged) of "a few dependencies well leveraged" by using TypeScript's AST construction utilities. We then use TypeScript's code printer to emit a formatted TypeScript file. By constructing a TypeScript AST rather than simply concatenating strings, we get a few benefits:

1. Type validation that our generated code will be syntactically valid TypeScript.
2. Automatic formatting of the generated code.

### GraphQL SDL code generation

Using the same build-time `GraphQLSchema` object from the previous step, we use `printSchema` from `graphql-js` to generate a GraphQL SDL file. `graphql-js` automatically strips server directives, but we also manually strip the definitions of our IR directives.

## At runtime

At runtime Grats is not involved at all. The generated TypeScript code is just a module that returns a `GraphQLSchema` object. It does not use any Grats code at runtime. In addition, we avoids needing to parse the GraphQL SDL at runtime, which can be a significant performance improvement, especially at the edge or in the browser.
