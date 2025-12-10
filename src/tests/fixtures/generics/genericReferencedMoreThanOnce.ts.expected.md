## input

```ts title="generics/genericReferencedMoreThanOnce.ts"
/** @gqlType */
type Err = {
  __typename: "Err";
  /** @gqlField */
  message: string;
};

/** @gqlUnion */
type Result<T> = T | Err;

/** @gqlType */
export type Page = {
  __typename: "Page";
  /** @gqlField */
  name: string;
};

/** @gqlType */
export type SomeType = {
  /** @gqlField */
  pageResult: Result<Page>;
  /** @gqlField */
  alsoPageResult: Result<Page>;
};
```

## Output

```
-- SDL --
union PageResult = Err | Page

type Err {
  message: String
}

type Page {
  name: String
}

type SomeType {
  alsoPageResult: PageResult
  pageResult: PageResult
}
-- TypeScript --
import { GraphQLSchema, GraphQLUnionType, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const ErrType: GraphQLObjectType = new GraphQLObjectType({
        name: "Err",
        fields() {
            return {
                message: {
                    name: "message",
                    type: GraphQLString
                }
            };
        }
    });
    const PageType: GraphQLObjectType = new GraphQLObjectType({
        name: "Page",
        fields() {
            return {
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        }
    });
    const PageResultType: GraphQLUnionType = new GraphQLUnionType({
        name: "PageResult",
        types() {
            return [ErrType, PageType];
        }
    });
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                alsoPageResult: {
                    name: "alsoPageResult",
                    type: PageResultType
                },
                pageResult: {
                    name: "pageResult",
                    type: PageResultType
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [PageResultType, ErrType, PageType, SomeTypeType]
    });
}
```