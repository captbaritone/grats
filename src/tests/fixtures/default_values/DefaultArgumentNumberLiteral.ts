import { Float, Int } from "../../../Types";

/** @GQLType */
export default class Query {
  /** @GQLField */
  intField({ count = 10 }: { count: Int }): string {
    return `${count} world!`;
  }
  /** @GQLField */
  floatField({ scale = 10.0 }: { scale: Float }): string {
    return `${scale} world!`;
  }
}
