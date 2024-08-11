/** @gqlInput */
type Greeting = {
  name: string;
  salutation: string;
};

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(greeting: Greeting): string {
    return `${greeting.salutation} ${greeting.name}!`;
  }
}
