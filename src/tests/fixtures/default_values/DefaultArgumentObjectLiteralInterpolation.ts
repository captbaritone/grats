import { Int } from "../../../Types";

const first = 10;
const offset = 100;
/** @gqlType */
export default class Query {
  /** @gqlField */
  someField1({
    input = { first, offset },
  }: {
    input?: ConnectionInput;
  }): string {
    return "hello";
  }
}

/** @gqlInput */
type ConnectionInput = {
  first: Int;
  offset: Int;
};
