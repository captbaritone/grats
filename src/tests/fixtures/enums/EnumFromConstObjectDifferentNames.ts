const Status = {
  Draft: "DRAFT",
  Published: "PUBLISHED",
} as const;

/** @gqlEnum */
type Status = (typeof Status)[keyof typeof Status];

/** @gqlType */
class Show {
  /** @gqlField */
  status: Status;
}
