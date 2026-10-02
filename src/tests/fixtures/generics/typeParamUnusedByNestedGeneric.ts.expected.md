# generics/typeParamUnusedByNestedGeneric.ts

## Input

```ts title="generics/typeParamUnusedByNestedGeneric.ts"
// `Bar` doesn't use its type parameter in a GraphQL position, so neither does
// `Foo`, and `Foo`'s type argument need not be a GraphQL type.
/** @gqlType */
type Bar<U> = {
  /** @gqlField */
  name: string;
  notGql: U;
};

/** @gqlType */
type Foo<T> = {
  /** @gqlField */
  bar: Bar<T>;
};

/** @gqlQueryField */
export function foo(): Foo<string> {
  return null as any;
}
```

## Output

### SDL

```graphql
type Bar {
  name: String
}

type Foo {
  bar: Bar
}

type Query {
  foo: Foo
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { foo as queryFooResolver } from "./typeParamUnusedByNestedGeneric";
export function getSchema(): GraphQLSchema {
    const BarType: GraphQLObjectType = new GraphQLObjectType({
        name: "Bar",
        fields() {
            return { name: {
                name: "name",
                type: GraphQLString
            } };
        }
    });
    const FooType: GraphQLObjectType = new GraphQLObjectType({
        name: "Foo",
        fields() {
            return { bar: {
                name: "bar",
                type: BarType
            } };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return { foo: {
                name: "foo",
                type: FooType,
                resolve() {
                    return queryFooResolver();
                }
            } };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [
            BarType,
            FooType,
            QueryType
        ]
    });
}
```