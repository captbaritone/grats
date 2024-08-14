/** @gqlInput */
type Greeting = {
  name: string;
  salutation: string;
};

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(
    /** @deprecated Unused! */
    greeting: Greeting = { name: "Alice", salutation: "Hullo" },
  ): string {
    return `Hullo`;
  }
}
