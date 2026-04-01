const ALL_STATUSES = ["valid", "123invalid"] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];
