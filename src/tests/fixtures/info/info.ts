import { Info } from "../../../Types";

/** @gqlType */
class User {
  /** @gqlField */
  greeting(info: Info): string {
    return "Hello!";
  }
}
