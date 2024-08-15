/** @gqlInput */
type Greeting = {
  name: string;
  salutation: string;
};

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(
    /** How to greet the user */
    greeting: Greeting,
  ): string {
    return `${greeting.salutation} ${greeting.name}!`;
  }
}
