const ALL_STATUSES = [
  "DRAFT",
  /** @deprecated Use DRAFT instead. */
  "UNPUBLISHED",
  "PUBLISHED",
] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];

/** @gqlType */
class Show {
  /** @gqlField */
  status: ShowStatus;
}
