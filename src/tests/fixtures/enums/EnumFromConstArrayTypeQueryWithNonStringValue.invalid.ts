const ALL_SHOW_STATUSES = ["draft", 42] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_SHOW_STATUSES)[number];
