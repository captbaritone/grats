import { ID } from "../../../Types";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  id(): ID {
    return "QUERY_ID";
  }
}
