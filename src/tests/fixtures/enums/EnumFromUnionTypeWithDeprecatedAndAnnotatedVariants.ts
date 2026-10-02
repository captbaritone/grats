import { Int } from "../../../Types";

/** @gqlDirective on ENUM_VALUE */
export function cost(args: { credits: Int }) {}

/** @gqlEnum */
type MyEnum =
  /**
   * The old name.
   * @deprecated Use VALID instead.
   */
  | "OK"
  /** @gqlAnnotate cost(credits: 1) */
  | "VALID"
  | "INVALID";

/** @gqlType */
export class SomeType {
  /** @gqlField */
  hello: MyEnum;
}
