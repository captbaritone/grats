## input

```ts title="interfaces/InterfaceExtendsInterface.ts"
/** @gqlInterface Node */
interface GqlNode {
  /** @gqlField */
  id: string;
}

/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/** @gqlInterface */
interface Actor extends GqlNode, Person {
  /** @gqlField */
  id: string;
  /** @gqlField */
  name: string;
}
```

## Output

### SDL

```graphql
interface Actor implements Node & Person {
  id: String
  name: String
}

interface Node {
  id: String
}

interface Person {
  name: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLInterfaceType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const NodeType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "Node",
        fields() {
            return {
                id: {
                    name: "id",
                    type: GraphQLString
                }
            };
        }
    });
    const PersonType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "Person",
        fields() {
            return {
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        }
    });
    const ActorType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "Actor",
        fields() {
            return {
                id: {
                    name: "id",
                    type: GraphQLString
                },
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        },
        interfaces() {
            return [NodeType, PersonType];
        }
    });
    return new GraphQLSchema({
        types: [ActorType, NodeType, PersonType]
    });
}
```