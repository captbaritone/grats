const ALL_STATUSES = ["DRAFT", 42, "PUBLISHED"] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];
