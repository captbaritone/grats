/**
 * @gqlInput
 */
export type Greeting =
  | { firstName: string }
  | { lastName: string; nickName: string };
