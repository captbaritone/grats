const ALL_STATUSES = [] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];
