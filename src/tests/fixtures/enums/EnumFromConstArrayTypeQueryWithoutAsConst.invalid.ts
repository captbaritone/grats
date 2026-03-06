const ALL_SHOW_STATUSES = ["draft", "scheduled", "unlisted", "published"];

/** @gqlEnum */
type ShowStatus = (typeof ALL_SHOW_STATUSES)[number];
