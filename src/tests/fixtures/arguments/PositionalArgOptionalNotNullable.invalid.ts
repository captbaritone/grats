/** @gqlInput */
type Greeting = {
  name: string;
  salutation: string;
};

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(greeting?: string): string {
    return `${greeting ?? "Hello"} World`;
  }
}
