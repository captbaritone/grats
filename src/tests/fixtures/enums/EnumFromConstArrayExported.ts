export const ALL_STATUSES = ["DRAFT", "PUBLISHED"] as const;

/** @gqlEnum */
export type ShowStatus = (typeof ALL_STATUSES)[number];
