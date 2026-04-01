namespace MyApp {
  const ALL_STATUSES = ["DRAFT", "PUBLISHED"] as const;

  /** @gqlEnum */
  type ShowStatus = (typeof ALL_STATUSES)[number];
}
