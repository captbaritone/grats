const Status = {
  /** Currently being edited */
  Draft: "DRAFT",
  /** Available to readers */
  Published: "PUBLISHED",
} as const;

/** @gqlEnum */
type Status = (typeof Status)[keyof typeof Status];

/** @gqlType */
class Show {
  /** @gqlField */
  status: Status;
}
