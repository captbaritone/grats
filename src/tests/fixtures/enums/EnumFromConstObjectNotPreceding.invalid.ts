const Status = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const;

const OTHER = "something";

/** @gqlEnum */
type Status = (typeof Status)[keyof typeof Status];
