import { Int } from "../../../Types";

/** @gqlType */
class User {
  /** @gqlField */
  name: string | null;
  /** @gqlField */
  greeting(
    greeting: string,
    otherName?: string | null,
    age?: Int | null,
  ): string {
    if (age != null && age < 12) {
      // Age appropriate greeting
      return `What's good ${this.name ?? otherName}!`;
    }
    return `${greeting}, ${this.name ?? otherName}!`;
  }
}
