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
