const ALL_SHOW_STATUSES = [] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_SHOW_STATUSES)[number];
