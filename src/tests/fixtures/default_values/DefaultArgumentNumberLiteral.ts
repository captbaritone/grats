import { Float, Int } from "../../../Types";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  intField({ count = 10 }: { count: Int }): string {
    return `${count} world!`;
  }
  /** @gqlField */
  floatField({ scale = 10.0 }: { scale: Float }): string {
    return `${scale} world!`;
  }
}
