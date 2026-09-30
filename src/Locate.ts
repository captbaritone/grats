import { Result } from "./utils/Result.js";
import { GratsDiagnostic } from "./utils/DiagnosticError.js";
import { callRustWithDocument, RustDocument } from "./rs/document.js";

/** Where `locate` found an entity. */
export type Located = {
  /** As `path:line:column`, with an absolute path. */
  location: string;
  /** A "Located here" diagnostic at the entity. */
  diagnostic: GratsDiagnostic;
};

/**
 * Given an entity name of the format `ParentType` or `ParentType.fieldName`,
 * locate the entity in the schema built from `doc` and return its location.
 */
export function locate(
  doc: RustDocument,
  entityName: string,
): Result<Located, string> {
  return JSON.parse(callRustWithDocument("locate", doc, { entityName }));
}
