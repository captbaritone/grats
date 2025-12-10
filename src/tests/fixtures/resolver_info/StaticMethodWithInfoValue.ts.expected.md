## input

```ts title="resolver_info/StaticMethodWithInfoValue.ts"
import { GqlInfo } from "../../../Types";

/** @gqlType */
export class SomeType {
  /** @gqlField */
  someField: string;

  /** @gqlField greeting */
  static greetz(_: Query, info: GqlInfo): string {
    return "Hello";
  }
}

/** @gqlType */
type Query = unknown;
```

## Output

```
-- SDL --
type Query {
  greeting: String
}

type SomeType {
  someField: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { SomeType as queryGreetingResolver } from "./StaticMethodWithInfoValue";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    resolve(source, _args, _context, info) {
                        return queryGreetingResolver.greetz(source, info);
                    }
                }
            };
        }
    });
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                someField: {
                    name: "someField",
                    type: GraphQLString
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [QueryType, SomeTypeType]
    });
}
```