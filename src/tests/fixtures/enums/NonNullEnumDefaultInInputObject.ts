// https://github.com/captbaritone/grats/issues/174

/** @gqlEnum */
type GreetingOptions = "Hello" | "Greetings" | "Sup";

/** @gqlInput */
type GreetingInput = {
  greeting: GreetingOptions;
};

/** @gqlQueryField */
export function hello(
  input: GreetingInput = { greeting: "Greetings" },
): string {
  return `${input.greeting} World`;
}
