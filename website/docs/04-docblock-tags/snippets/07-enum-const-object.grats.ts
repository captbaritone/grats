const Status = {
  /** Currently being edited */
  Draft: "DRAFT",
  /** Available to readers */
  Published: "PUBLISHED",
  /** @deprecated Use DRAFT instead */
  Hidden: "HIDDEN",
} as const;

/** @gqlEnum */
type Status = (typeof Status)[keyof typeof Status];
