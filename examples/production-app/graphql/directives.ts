import {
  defaultFieldResolver,
  GraphQLError,
  GraphQLFieldConfig,
} from "graphql";
import { Int } from "grats";
import { Ctx } from "../ViewerContext";

/**
 * Some fields cost credits to access. This directive specifies how many credits
 * a given field costs.
 *
 * @gqlDirective
 */
export function cost<T>(
  field: GraphQLFieldConfig<T, Ctx>,
  credits: Int,
): GraphQLFieldConfig<T, Ctx> {
  const originalResolve = field.resolve ?? defaultFieldResolver;
  field.resolve = (source, resolverArgs, context, info) => {
    if (context.credits < credits) {
      // Using `GraphQLError` here ensures the error is not masked by Yoga.
      throw new GraphQLError(
        `Insufficient credits remaining. This field cost ${credits} credits.`,
      );
    }
    context.credits -= credits;
    return originalResolve(source, resolverArgs, context, info);
  };
  return field;
}
