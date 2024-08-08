/**
 * @gqlInput
 * @oneOf
 */
export type Greeting =
  | { firstName: string }
  | { lastName: Array<string | null> };
