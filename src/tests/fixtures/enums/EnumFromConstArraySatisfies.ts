const ALL_STATUSES = [
  "DRAFT",
  "PUBLISHED",
] as const satisfies readonly string[];

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];

/** @gqlType */
class Show {
  /** @gqlField */
  status: ShowStatus;
}
