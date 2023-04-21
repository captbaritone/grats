import { Float } from "../../../../Types";

/** @gqlType */
export default class Query {
  /** @gqlField */
  ratio() {
    return getFloat(10);
  }
}

function getFloat(n: number): Float {
  return n;
}
