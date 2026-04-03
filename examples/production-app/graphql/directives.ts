import { GraphQLError, GraphQLFieldResolver } from "graphql";
import { Int, FieldDirective } from "grats";
import { Ctx } from "../ViewerContext.js";

/**
 * Some fields cost credits to access. This directive specifies how many credits
 * a given field costs.
 *
 * By returning `FieldDirective`, Grats will automatically wrap the resolver
 * function with this directive's implementation — no manual `mapSchema` needed.
 *
 * @gqlDirective cost on FIELD_DEFINITION
 */
export function debitCredits(args: { credits: Int }): FieldDirective {
  return (next: GraphQLFieldResolver<unknown, Ctx>) =>
    (source, resolverArgs, context, info) => {
      if (context.credits < args.credits) {
        // Using `GraphQLError` here ensures the error is not masked by Yoga.
        throw new GraphQLError(
          `Insufficient credits remaining. This field cost ${args.credits} credits.`,
        );
      }
      context.credits -= args.credits;
      return next(source, resolverArgs, context, info);
    };
}
