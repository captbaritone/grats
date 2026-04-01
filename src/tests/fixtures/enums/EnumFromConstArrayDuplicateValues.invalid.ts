const ALL_STATUSES = ["DRAFT", "PUBLISHED", "DRAFT"] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];
