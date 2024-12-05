# JavaScript Resolver Directive Spec

This document (DRAFT) describes GraphQL directives used to annotate a GraphQL schema which is backed by JavaScript resolvers. Its goal is to encode enough information that a complete GraphQL executor for the schema can be inferred directly from the GraphQL Schema Definition Language (SDL) document. This approach is especially attractive for [implementation-first](https://jordaneldredge.com/blog/implementation-first/) servers where the GraphQL schema _and how to execute it_ can be inferred directly from the resolver code itself.

## Motivation

Ideally this scheme can enabling decoupling and interoperability between tools. For example:

- Tools that could _generate_ SDL with these directives:
  - [Grats](https://grats.capt.dev)
  - [Relay Resolvers](https://relay.dev/docs/next/guides/relay-resolvers/introduction/)
  - [Pylon](https://pylon.cronit.io/)
- Tools that could _consume_ SDL with these directives:
  - Tools like [Grat's TypeScript codegen](https://github.com/captbaritone/grats/blob/d8846a46117503c095be728ce1b13a62795c03fd/src/codegen.ts) which generates code for a `GraphQLSchema` object.
  - A hypothetical alternative to Grat's codegen which produces [GraphQL-Tools resolver maps](https://the-guild.dev/graphql/tools/docs/resolvers).
  - Relay's compiler which generates runtime artifacts capable of evaluating Relay Resolvers for queries
  - A hypothetical GraphQL executor which directly understands these annotations and can execute operations without any codegen.

If adopted this could enable scenarios like a schema inferred by Grats could be executed by Relay Resolvers, or a schema inferred by Relay could be used to generate a GraphQL-Tools resolver map.

## First Draft

This initial draft was defined based on the internal metadata tracked by Grats and Relay Resolvers. It should be sufficient to support those two tools in this current form. We should proceed through an initial feedback phase where we seek feedback from other tools which might benefit from this specification. As/if new tools emerge in the ecosystem we should consider expanding/evolving the directives.

## Directives

```graphql
"""
Describes the backing resolver for a field.
"""
directive @resolver(kind: ResolverKind!) on FIELD_DEFINITION

"""
Describes a resolver's implementation in one of several flavors.
"""
input ResolverKind @oneOf {
  """
  The resolver is a simple property on the source object.
  """
  property: PropertyResolver
  """
  The resolver is a method on the source object.
  """
  method: MethodResolver
  """
  The resolver is function exported from a module.
  """
  function: FunctionResolver
  """
  The resolver is static method on a class exported from a module.
  """
  staticMethod: StaticMethodResolver
}

"""
Describes a resolver that is defined as a property or getter on the source object.
"""
input PropertyResolver {
  """
  The name of the property on the parent object. If omitted the field name is used.
  """
  name: String
}

"""
Describes a resolver that is defined as a method on the source object.
"""
input MethodResolver {
  """
  The name of the method on the source object. If omitted the field name is used.
  """
  name: String
  """
  An ordered list of positional arguments expected by the resolver method.
  """
  arguments: [ResolverArgument]
}

"""
Describes a resolver that is defined as a function.
"""
input FunctionResolver {
  """
  The path of the module from which the function is exported.
  TODO: What should this be relative to?
  TODO: How do we support non-path imports, like imports from libraries?
  """
  path: String!

  """
  The name under which the function is exported. If this property is omitted, a default export is assumed.
  """
  exportName: String

  """
  An ordered list of positional arguments expected by the resolver method.
  """
  arguments: [ResolverArgument]
}

"""
Describes a resolver that is defined as a static method on a class.
"""
input StaticMethodResolver {
  """
  The path of the module from which the class is exported.
  TODO: What should this be relative to?
  TODO: How do we support non-path imports, like imports from libraries?
  """
  path: String!

  """
  The name under which the class is exported. If this property is omitted, a default export is assumed.
  """
  exportName: String

  """
  The name of the static method on the exported class which defines the resolver.
  """
  name: String!

  """
  An ordered list of positional arguments expected by the resolver method.
  """
  arguments: [ResolverArgument]
}

"""
Describes a positional JavaScript argument expected by a resolver function or method.
"""
input ResolverArgument @oneOf {
  """
  The source object. This is what graphql-js resolvers expect in the first position.
  """
  source: Boolean

  """
  An object map containing all the GraphQL arguments.
  This is what graphql-js resolvers expect in the second position.
  """
  argumentsObject: Boolean

  """
  The GraphQL execution context. This is what graphql-js resolvers expect in the third position.
  """
  context: Boolean

  """
  The GraphQL "info" object. This is what graphql-js resolvers expect in the fourth position.
  """
  information: Boolean

  """
  The single GraphQL argument with the given name. This allows resolvers to access individual arguments as positional arguments instead of always needing to access them as a single object map.
  """
  named: String
}
```

## Examples

Here are some examples from Grats and how they would be encoded using this scheme.

### Simple properties and methods

```ts
/** @gqlType */
class User {
  /** @gqlField */
  name: string;

  /** @gqlField */
  greet(greeting: string): string {
    return `${greeting}, ${this.name}`;
  }
}
```

```graphql
type User {
  greet(greeting: String!): String
    @resolver(kind: { method: { arguments: [{ name: "greeting" }] } })

  name: String @resolver(kind: { property: {} })
}
```

### Function resolver

```ts
/** @gqlType */
type User = {
  /** @gqlField name */
  userName: string;
};

/** @gqlField */
export function greet(user: User, greeting: string): string {
  return `${greeting}, ${user.name}`;
}
```

```graphql
type User {
  greet(greeting: String!): String
    @resolver(
      kind: {
        path: "path/to/module.js"
        exportName: "greet"
        function: { arguments: [{ source: true }, { name: "greeting" }] }
      }
    )

  name: String @resolver(kind: { property: { name: "username" } })
}
```

## TODO

Here are some questions that remain unanswered:

1. How should we encode import paths?
2. How should we encode custom scalar serialization/deserialization functions?
3. ???
