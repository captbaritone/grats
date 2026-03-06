const ALL_SHOW_STATUSES = ["draft", "draft"] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_SHOW_STATUSES)[number];
