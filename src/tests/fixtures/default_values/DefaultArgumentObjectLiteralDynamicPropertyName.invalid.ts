import { Int } from "../../../Types";

const x = "first";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  someField1({
    input = { [x]: 10, offset: 100 },
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
