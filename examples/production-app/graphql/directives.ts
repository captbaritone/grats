import { defaultFieldResolver, GraphQLError, GraphQLSchema } from "graphql";
import { Int } from "grats";
import { Ctx } from "../ViewerContext";
import { getDirective, MapperKind, mapSchema } from "@graphql-tools/utils";

/**
 * Some fields cost credits to access. This directive specifies how many credits
 * a given field costs.
 *
 * @gqlDirective cost on FIELD_DEFINITION
 */
export function debitCredits(args: { credits: Int }, context: Ctx): void {
  if (context.credits < args.credits) {
    // Using `GraphQLError` here ensures the error is not masked by Yoga.
    throw new GraphQLError(
      `Insufficient credits remaining. This field cost ${args.credits} credits.`,
    );
  }
  context.credits -= args.credits;
}

type CostArgs = { credits: Int };

// Monkey patches the `resolve` function of fields with the `@cost` directive
// to deduct credits from the user's account when the field is accessed.
export function applyCreditLimit(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const costDirective = getDirective(schema, fieldConfig, "cost", [
        "grats",
        "directives",
      ]);
      if (costDirective == null || costDirective.length === 0) {
        return fieldConfig;
      }

      const originalResolve = fieldConfig.resolve ?? defaultFieldResolver;
      fieldConfig.resolve = (source, args, context, info) => {
        debitCredits(costDirective[0] as CostArgs, context);
        return originalResolve(source, args, context, info);
      };
      return fieldConfig;
    },
  });
}
