import { GraphQLObjectType, GraphQLSchema } from "graphql";
import { Int } from "grats";
/**
 * Specifies the largest allowed value for an integer argument.
 * @gqlDirective
 * @on ARGUMENT_DEFINITION
 */
export function max(_args: { value: Int }): void {
  // noop
}

export function applyMaxLimit(schema: GraphQLSchema): void {
  // Iterate over every field resolver in the schema
  for (const type of Object.values(schema.getTypeMap())) {
    if (type instanceof GraphQLObjectType) {
      //
    }
  }
  // noop
}
