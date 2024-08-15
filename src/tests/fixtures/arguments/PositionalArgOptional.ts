/** @gqlInput */
type Greeting = {
  name: string;
  salutation: string;
};

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(greeting?: string | null): string {
    return `${greeting ?? "Hello"} World`;
  }
}
