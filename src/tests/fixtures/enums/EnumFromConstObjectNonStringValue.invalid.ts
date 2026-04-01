const Status = {
  Draft: "DRAFT",
  Published: 42,
} as const;

/** @gqlEnum */
type Status = (typeof Status)[keyof typeof Status];
