const ALL_STATUSES = ["DRAFT", "PUBLISHED"];

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];
