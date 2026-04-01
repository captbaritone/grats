const Status = {} as const;

/** @gqlEnum */
type Status = (typeof Status)[keyof typeof Status];
