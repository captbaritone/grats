# interfaces/InterfaceMergedIntoObject.ts

## Input

```ts title="interfaces/InterfaceMergedIntoObject.ts"
declare const Foo: {
  prototype: Foo;
  new (): Foo;
};

/** @gqlInterface */
interface Foo {
  /** @gqlField */
  id: string;
}
```

## Output

### SDL

```graphql
interface Foo {
  id: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLInterfaceType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const FooType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "Foo",
        fields() {
            return {
                id: {
                    name: "id",
                    type: GraphQLString
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [FooType]
    });
}
```