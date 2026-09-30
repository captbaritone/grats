import { DocumentNode, Location } from "graphql";
import { Result, ok } from "./utils/Result.js";
import {
  EncodedLocation,
  encodeLocateRequest,
  SourceTable,
} from "./rs/codec.js";
import { callRust } from "./rs/load.js";

/**
 * Given an entity name of the format `ParentType` or `ParentType.fieldName`,
 * locate the entity in the schema built from `doc` and return its location.
 */
export function locate(
  doc: DocumentNode,
  entityName: string,
): Result<Location, string> {
  const sources = new SourceTable();
  const result: Result<EncodedLocation, string> = JSON.parse(
    callRust("locate", encodeLocateRequest({ doc, entityName }, sources)),
  );
  if (result.kind === "ERROR") {
    return result;
  }
  return ok(sources.decodeLocation(result.value));
}
