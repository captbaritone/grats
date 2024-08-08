// Known issue, descriptions are not parsed?

/**
 * @gqlInput
 * @oneOf
 */
export type Greeting =
  /** First Name */
  | { firstName: string }
  /** Last Name */
  | { lastName: string };
