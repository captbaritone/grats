import { GraphQLFieldResolver } from "graphql";

/**
 * This is my custom directive.
 * @gqlDirective
 * @on FIELD_DEFINITION
 */
export function customDirective(
  args: { someArg: string },
  _someArg: GraphQLFieldResolver<unknown, unknown>,
) {
  //
}
