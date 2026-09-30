import { DocumentNode, Location } from "graphql";
import { Result, ok } from "./utils/Result.js";
import { EncodedLocation } from "./rs/codec.js";
import { callRustWithDocument } from "./rs/document.js";

/**
 * Given an entity name of the format `ParentType` or `ParentType.fieldName`,
 * locate the entity in the schema built from `doc` and return its location.
 */
export function locate(
  doc: DocumentNode,
  entityName: string,
): Result<Location, string> {
  const { output, sources } = callRustWithDocument("locate", doc, {
    entityName,
  });
  const result: Result<EncodedLocation, string> = JSON.parse(output);
  if (result.kind === "ERROR") {
    return result;
  }
  return ok(sources.decodeLocation(result.value));
}
