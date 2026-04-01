// Descriptions on array elements are silently ignored because TypeScript
// does not attach JSDoc comments to string literal expressions.
// Use a const object or TypeScript enum if you need per-value descriptions.
const ALL_STATUSES = [
  /** Currently being edited */
  "DRAFT",
  /** Available to readers */
  "PUBLISHED",
] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];

/** @gqlType */
class Show {
  /** @gqlField */
  status: ShowStatus;
}
