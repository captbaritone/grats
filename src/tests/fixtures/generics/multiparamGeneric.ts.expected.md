## input

```ts title="generics/multiparamGeneric.ts"
/** @gqlUnion */
type Result<V, E> = V | E;

/** @gqlType */
type Err = {
  __typename: "Err";
  /** @gqlField */
  error: string;
};

/** @gqlType */
type Page = {
  __typename: "Page";
  /** @gqlField */
  title: string;
};

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function pageResult(_: Query): Result<Page, Err> {
  return { title: "Hello", __typename: "Page" };
}
```

## Output

### SDL

```graphql
union PageErrResult = Err | Page

type Err {
  error: String
}

type Page {
  title: String
}

type Query {
  pageResult: PageErrResult
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLUnionType, GraphQLString } from "graphql";
import { pageResult as queryPageResultResolver } from "./multiparamGeneric";
export function getSchema(): GraphQLSchema {
    const ErrType: GraphQLObjectType = new GraphQLObjectType({
        name: "Err",
        fields() {
            return {
                error: {
                    name: "error",
                    type: GraphQLString
                }
            };
        }
    });
    const PageType: GraphQLObjectType = new GraphQLObjectType({
        name: "Page",
        fields() {
            return {
                title: {
                    name: "title",
                    type: GraphQLString
                }
            };
        }
    });
    const PageErrResultType: GraphQLUnionType = new GraphQLUnionType({
        name: "PageErrResult",
        types() {
            return [ErrType, PageType];
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                pageResult: {
                    name: "pageResult",
                    type: PageErrResultType,
                    resolve(source) {
                        return queryPageResultResolver(source);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [PageErrResultType, ErrType, PageType, QueryType]
    });
}
```