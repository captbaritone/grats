/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ if: x = false }: { if: boolean }): string {
    return x ? "hello" : "world";
  }
}
