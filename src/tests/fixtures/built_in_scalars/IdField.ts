import { ID } from "../../../Types";

/** @gqlType */
export default class Query {
  /** @gqlField */
  id(): ID {
    return "QUERY_ID";
  }
}
