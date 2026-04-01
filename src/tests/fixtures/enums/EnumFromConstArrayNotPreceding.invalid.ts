const ALL_STATUSES = ["DRAFT", "PUBLISHED"] as const;

const OTHER = "something";

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];
