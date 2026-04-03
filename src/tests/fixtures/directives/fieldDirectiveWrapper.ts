import { Int, FieldDirective } from "../../../Types";
import { GraphQLFieldResolver } from "graphql";

/**
 * Limits the rate of field resolution.
 * @gqlDirective on FIELD_DEFINITION
 */
export function rateLimit(args: { max: Int }): FieldDirective {
  return (next: GraphQLFieldResolver<unknown, unknown>) =>
    (source, args, context, info) => {
      return next(source, args, context, info);
    };
}

/**
 * All likes in the system.
 * @gqlQueryField
 * @gqlAnnotate rateLimit(max: 10)
 */
export function likes(): string {
  return "hello";
}
