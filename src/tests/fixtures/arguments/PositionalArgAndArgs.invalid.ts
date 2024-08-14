/** @gqlInput */
type Greeting = {
  name: string;
  salutation: string;
};

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(greeting: Greeting, args: { notGreeting: string }): string {
    return `${greeting.salutation} ${greeting.name} ${args.notGreeting}!`;
  }
}
