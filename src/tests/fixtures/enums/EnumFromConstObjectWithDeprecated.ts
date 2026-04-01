const Status = {
  Draft: "DRAFT",
  Published: "PUBLISHED",
  /** @deprecated Use DRAFT instead */
  Hidden: "HIDDEN",
} as const;

/** @gqlEnum */
type Status = (typeof Status)[keyof typeof Status];

/** @gqlType */
class Show {
  /** @gqlField */
  status: Status;
}
