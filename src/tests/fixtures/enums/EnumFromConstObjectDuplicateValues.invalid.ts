const Status = {
  Draft: "DRAFT",
  AlsoDraft: "DRAFT",
} as const;

/** @gqlEnum */
type Status = (typeof Status)[keyof typeof Status];
