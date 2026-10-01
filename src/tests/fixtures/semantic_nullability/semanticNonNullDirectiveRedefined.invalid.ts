// { "strictSemanticNullability": true }

/**
 * @gqlDirective on FIELD_DEFINITION
 */
export function semanticNonNull() {}

/** @gqlType */
export class User {
  /** @gqlField */
  name(): string {
    return "Alice";
  }
}
