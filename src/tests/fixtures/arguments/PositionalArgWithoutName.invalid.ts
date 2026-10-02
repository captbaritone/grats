/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello([greeting]: string[]): string {
    return `${greeting} World`;
  }
}
