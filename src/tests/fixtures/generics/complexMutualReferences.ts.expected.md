# generics/complexMutualReferences.ts

## Input

```ts title="generics/complexMutualReferences.ts"
// `Foo` and `Bar` pass their type parameter to each other, but neither uses it
// in a GraphQL position, so they're not generic.
/** @gqlType */
type Foo<T> = {
  /** @gqlField */
  someField: Bar<T>;
  /** @gqlField */
  baz: Baz;
};

/** @gqlType */
type Bar<T> = {
  /** @gqlField */
  anotherField: Foo<T>;
};

/** @gqlType */
type Baz = {
  /** @gqlField */
  bazField: Bar<Baz>;
};
```

## Output

### SDL

```graphql
type Bar {
  anotherField: Foo
}

type Baz {
  bazField: Bar
}

type Foo {
  baz: Baz
  someField: Bar
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const BazType: GraphQLObjectType = new GraphQLObjectType({
        name: "Baz",
        fields() {
            return { bazField: {
                name: "bazField",
                type: BarType
            } };
        }
    });
    const FooType: GraphQLObjectType = new GraphQLObjectType({
        name: "Foo",
        fields() {
            return {
                baz: {
                    name: "baz",
                    type: BazType
                },
                someField: {
                    name: "someField",
                    type: BarType
                }
            };
        }
    });
    const BarType: GraphQLObjectType = new GraphQLObjectType({
        name: "Bar",
        fields() {
            return { anotherField: {
                name: "anotherField",
                type: FooType
            } };
        }
    });
    return new GraphQLSchema({ types: [
        BarType,
        BazType,
        FooType
    ] });
}
```