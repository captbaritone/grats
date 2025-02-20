import {
  defaultFieldResolver,
  GraphQLError,
  GraphQLObjectType,
  GraphQLSchema,
} from "graphql";
import { Int } from "grats";
import { Ctx } from "../ViewerContext";

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

export interface FieldExtensions {
  grats?: {
    directives: { name: "cost"; args: { credits: number } }[];
  };
}

// Monkey patches the `resolve` function of fields with the `@cost` directive
// to deduct credits from the user's account when the field is accessed.
export function applyCreditLimit(schema: GraphQLSchema): void {
  // Iterate over every field resolver in the schema
  for (const type of Object.values(schema.getTypeMap())) {
    if (type instanceof GraphQLObjectType) {
      for (const field of Object.values(type.getFields())) {
        const extensions = field.extensions as FieldExtensions | undefined;
        if (extensions == null || extensions.grats == null) {
          continue;
        }
        const costDirective = extensions.grats.directives.find(
          (directive) => directive.name === "cost",
        );

        if (costDirective == null) {
          continue;
        }

        const originalResolver = field.resolve ?? defaultFieldResolver;
        field.resolve = (source, args, context, info) => {
          debitCredits(costDirective.args, context);
          return originalResolver(source, args, context, info);
        };
      }
    }
  }
}
