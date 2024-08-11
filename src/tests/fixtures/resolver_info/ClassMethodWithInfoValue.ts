import { GqlInfo } from "../../../Types";

/** @gqlType */
export class SomeType {
  /** @gqlField greeting */
  greetz(info: GqlInfo): string {
    return "Hello";
  }
}
