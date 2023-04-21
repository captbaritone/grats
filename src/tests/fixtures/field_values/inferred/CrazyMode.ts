import { Float } from "../../../../Types";

/** @gqlType */
export default class Query {
  /** @gqlField */
  ratio() {
    return indirection(getFloat(10));
  }
}

function getFloat(n: number): Float {
  return n;
}

function indirection<T>(x: T): Promise<T | null> | T | null {
  return x;
}
