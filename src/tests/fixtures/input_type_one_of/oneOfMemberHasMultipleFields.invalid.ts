/**
 * @gqlInput
 * @oneOf
 */
export type Greeting =
  | { firstName: string }
  | { lastName: string; nickName: string };
