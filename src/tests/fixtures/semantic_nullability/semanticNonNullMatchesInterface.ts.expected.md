# semantic_nullability/semanticNonNullMatchesInterface.ts

## Input

```ts title="semantic_nullability/semanticNonNullMatchesInterface.ts"
// { "strictSemanticNullability": true }

/** @gqlInterface */
interface IPerson {
  /** @gqlField */
  name(): string;
}

/** @gqlType */
export class User implements IPerson {
  __typename = "User" as const;
  /** @gqlField */
  name(): string {
    if (Math.random() < 0.5) {
      throw new Error("Stuff happens...");
    }
    return "Alice";
  }
}
```

## Output

### SDL

```graphql
"""
Indicates that a field's result is semantically non null at the indicated levels:
it is only null if there is a matching error in the `errors` array of the response.
In all other cases, the position contains a value.

Tools doing code generation may use this information to generate the position as non-null if field errors are handled out of band:

```graphql
type User {
    # email is semantically non-null and can be generated as non-null by error-handling clients.
    email: String @semanticNonNull
}
```

The `levels` argument selects which levels of a (possibly nested) list type are semantically non null:

```graphql
type User {
    # friends is semantically non null
    friends: [User] @semanticNonNull # same as @semanticNonNull(levels: [0])

    # every friends[k] is semantically non null
    friends: [User] @semanticNonNull(levels: [1])

    # friends as well as every friends[k] is semantically non null
    friends: [User] @semanticNonNull(levels: [0, 1])
}
```

`levels` are zero indexed, where level 0 is the field's own value.
A level that is negative, or that exceeds the list dimensionality of the annotated field, is an error.
Applying `@semanticNonNull` to a level that is already Non-Null is an error.
"""
directive @semanticNonNull(levels: [Int!]! = [0]) on FIELD_DEFINITION

interface IPerson {
  name: String @semanticNonNull
}

type User implements IPerson {
  name: String @semanticNonNull
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLList, GraphQLInt, specifiedDirectives, GraphQLInterfaceType, GraphQLString, GraphQLObjectType, defaultFieldResolver } from "graphql";
async function assertNonNull<T>(value: T | Promise<T>): Promise<T> {
    const awaited = await value;
    if (awaited == null) throw new Error("Cannot return null for semantically non-nullable field.");
    return awaited;
}
export function getSchema(): GraphQLSchema {
    const IPersonType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "IPerson",
        fields() {
            return { name: {
                name: "name",
                type: GraphQLString
            } };
        }
    });
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return { name: {
                name: "name",
                type: GraphQLString,
                resolve(source, args, context, info) {
                    return assertNonNull(defaultFieldResolver(source, args, context, info));
                }
            } };
        },
        interfaces() {
            return [IPersonType];
        }
    });
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
            name: "semanticNonNull",
            locations: [DirectiveLocation.FIELD_DEFINITION],
            description: "Indicates that a field's result is semantically non null at the indicated levels:\nit is only null if there is a matching error in the `errors` array of the response.\nIn all other cases, the position contains a value.\n\nTools doing code generation may use this information to generate the position as non-null if field errors are handled out of band:\n\n```graphql\ntype User {\n    # email is semantically non-null and can be generated as non-null by error-handling clients.\n    email: String @semanticNonNull\n}\n```\n\nThe `levels` argument selects which levels of a (possibly nested) list type are semantically non null:\n\n```graphql\ntype User {\n    # friends is semantically non null\n    friends: [User] @semanticNonNull # same as @semanticNonNull(levels: [0])\n\n    # every friends[k] is semantically non null\n    friends: [User] @semanticNonNull(levels: [1])\n\n    # friends as well as every friends[k] is semantically non null\n    friends: [User] @semanticNonNull(levels: [0, 1])\n}\n```\n\n`levels` are zero indexed, where level 0 is the field's own value.\nA level that is negative, or that exceeds the list dimensionality of the annotated field, is an error.\nApplying `@semanticNonNull` to a level that is already Non-Null is an error.",
            args: { levels: {
                type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLInt))),
                defaultValue: [0]
            } }
        })],
        types: [IPersonType, UserType]
    });
}
```