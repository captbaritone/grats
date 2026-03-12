const ALL_SHOW_STATUSES = [
  "draft",
  "scheduled",
  "unlisted",
  "published",
] as const;

/** @gqlType */
class Show {
  /** @gqlField */
  status: ShowStatus;
}

/** @gqlEnum */
type ShowStatus = (typeof ALL_SHOW_STATUSES)[number];
