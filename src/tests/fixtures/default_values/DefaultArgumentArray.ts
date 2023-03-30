import { Int } from "../../../Types";

/** @gqlType */
export default class Query {
  /** @gqlField */
  someField1({ inputs = ["hello", "there"] }: { inputs?: string[] }): string {
    return inputs.join("|");
  }
}
