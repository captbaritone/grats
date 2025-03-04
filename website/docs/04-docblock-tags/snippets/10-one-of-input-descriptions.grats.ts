/**
 * @gqlInput
 */
export type UserBy =
  | {
      /** Fetch the user by email */
      email: string;
    }
  | {
      /** Fetch the user by username */
      username: string;
    };
