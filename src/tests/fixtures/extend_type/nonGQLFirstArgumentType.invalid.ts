/** @gqlType */
class Query {
  // No fields
}

class Foo {}

/** @gqlField */
export function greeting(query: Foo): string {
  return "Hello world!";
}
