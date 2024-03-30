import { Info } from "../../../Types";

/** @gqlType */
class User {
  /** @gqlField */
  greeting({ fieldName }: Info): string {
    return `Hello from ${fieldName}!`;
  }
}
