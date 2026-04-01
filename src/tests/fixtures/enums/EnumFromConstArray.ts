const ALL_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];

/** @gqlType */
class Show {
  /** @gqlField */
  status: ShowStatus;
}
