import { GqlInfo } from "../../../Types";

/** @gqlType */
export class SomeType {
  /** @gqlField */
  someField: string;

  /** @gqlField greeting */
  static greetz(_: Query, info: GqlInfo): string {
    return "Hello";
  }
}

/** @gqlType */
type Query = unknown;
