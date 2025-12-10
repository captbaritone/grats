## input

```ts title="extend_type/functionFieldOnTypeDefinedWithInterface.ts"
// https://twitter.com/edvinwennerdahl/status/1748436186840904103

/** @gqlType */
interface Cat {}

/** @gqlField */
export function catSound(obj: Cat): string {
  return "meow";
}
```

## Output

```
-- SDL --
type Cat {
  catSound: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { catSound as catCatSoundResolver } from "./functionFieldOnTypeDefinedWithInterface";
export function getSchema(): GraphQLSchema {
    const CatType: GraphQLObjectType = new GraphQLObjectType({
        name: "Cat",
        fields() {
            return {
                catSound: {
                    name: "catSound",
                    type: GraphQLString,
                    resolve(source) {
                        return catCatSoundResolver(source);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [CatType]
    });
}
```