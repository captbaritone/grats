import { Int } from "../../../Types";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  someField1({
    input = { first: func(), offset: func() },
  }: {
    input?: ConnectionInput | null;
  }): string {
    return "hello";
  }
}

function func() {
  return 10;
}

/** @gqlInput */
type ConnectionInput = {
  first: Int;
  offset: Int;
};
