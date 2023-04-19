/** @gqlType */
export default class Query {
  /** @gqlField */
  hello({
    greeting,
  }: {
    /** @deprecated Not used anymore */
    greeting?: string | null;
  }): string {
    return "Hello world!";
  }
}
