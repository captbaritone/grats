import { GraphQLObjectType, GraphQLSchema } from "graphql";
import { Int } from "grats";
/**
 * Specifies the largest allowed value for an integer argument.
 * @gqlDirective
 * @on ARGUMENT_DEFINITION
 */
export function max(args: { value: Int }): void {
  // noop
}

export function applyMaxLimit(schema: GraphQLSchema): void {
  // Iterate over every field resolver in the schema
  for (const type of Object.values(schema.getTypeMap())) {
    if (type instanceof GraphQLObjectType) {
      for (const field of Object.values(type.getFields())) {
        // Iterate over every argument for the field
        for (const arg of field.args) {
          const maxDirective = arg.astNode?.directives?.(
            (d) => d.name.value === "max",
          );
        }
      }
    }
  }
  // noop
}
