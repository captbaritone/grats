// trim-start
import { Int, FieldDirective } from "grats";
import { GraphQLFieldResolver } from "graphql";
// trim-end
/**
 * Limits the rate of field resolution.
 * @gqlDirective on FIELD_DEFINITION
 */
export function rateLimit(args: { max: Int }): FieldDirective {
  return (next: GraphQLFieldResolver<unknown, unknown>) =>
    (source, args, context, info) => {
      // Custom logic runs before the resolver
      return next(source, args, context, info);
    };
}
