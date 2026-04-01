const ALL_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

/** @gqlEnum */
type Status = (typeof ALL_STATUSES)[number];
