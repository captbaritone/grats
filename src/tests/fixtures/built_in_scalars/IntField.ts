import { Int } from "../../../Types";

/** @gqlType */
export default class Query {
  /** @gqlField */
  age(): Int {
    return 10;
  }
}
