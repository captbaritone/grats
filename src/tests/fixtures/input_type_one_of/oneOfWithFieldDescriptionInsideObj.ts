// Known issue, descriptions are not parsed?

/**
 * @gqlInput
 */
export type Greeting =
  | {
      /** First Name */
      firstName: string;
    }
  | {
      /** Last Name */
      lastName: string;
    };
