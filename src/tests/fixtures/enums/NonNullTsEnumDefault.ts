// https://github.com/captbaritone/grats/issues/174

/** @gqlEnum */
enum GreetingOptions {
  Hello = "HELLO",
  // Note that the casing between the variant name and the value is different.
  Greetings = "GREETING",
  Sup = "SUP",
}

/** @gqlQueryField */
export function hello(
  greeting: GreetingOptions = GreetingOptions.Greetings,
): string {
  return `${greeting} World`;
}
