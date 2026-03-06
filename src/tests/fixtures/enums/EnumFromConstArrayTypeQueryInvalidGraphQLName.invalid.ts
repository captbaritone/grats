const ALL_SHOW_STATUSES = ["draft-status"] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_SHOW_STATUSES)[number];
