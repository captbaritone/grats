import { Int } from "../../../Types";

const defaultArgs = { first: 10, offset: 10 };

/** @gqlType */
export default class Query {
  /** @gqlField */
  someField1({
    input = { ...defaultArgs },
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
