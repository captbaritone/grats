/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export function greeting(/* Without an arg we can't infer the type! */): string {
  return "Hello world!";
}
