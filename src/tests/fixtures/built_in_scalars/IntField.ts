import { Int } from "../../../Types";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  age(): Int {
    return 10;
  }
}
