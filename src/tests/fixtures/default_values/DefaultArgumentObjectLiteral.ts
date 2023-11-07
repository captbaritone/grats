import { Int } from "../../../Types";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  someField1({
    input = { first: 10, offset: 100 },
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
