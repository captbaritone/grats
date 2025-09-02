import { GraphQLNamedType, GraphQLSchema } from "graphql";
import {
  DiagnosticsWithoutLocationResult,
  locationlessErr,
} from "../utils/DiagnosticError";
import { err, ok } from "../utils/Result";
import * as E from "../Errors";

/**
 * We want to support a "getting started" experience where users can run `npx
 * grats` and let the error messages guide them to getting something working.
 *
 * So, even though an empty schema is technically valid, we treat it as an error
 * so we can provide the user with a helpful message teaching them about defining
 * types.
 */
export function validateSomeTypesAreDefined(
  schema: GraphQLSchema,
): DiagnosticsWithoutLocationResult<GraphQLSchema> {
  const types = Object.values(schema.getTypeMap());
  if (!types.some((t) => isUserDefinedType(t))) {
    return err([locationlessErr(E.noTypesDefined())]);
  }
  return ok(schema);
}

function isUserDefinedType(type: GraphQLNamedType): boolean {
  return !type.name.startsWith("__");
}
