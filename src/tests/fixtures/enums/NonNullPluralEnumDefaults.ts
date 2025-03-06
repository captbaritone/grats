// https://github.com/captbaritone/grats/issues/174

/** @gqlEnum */
type GreetingOptions = "Hello" | "Greetings" | "Sup";

/** @gqlQueryField */
export function hello(
  greeting: GreetingOptions[] = ["Greetings", "Hello"],
): string {
  return `${greeting.join(", ")} World`;
}
