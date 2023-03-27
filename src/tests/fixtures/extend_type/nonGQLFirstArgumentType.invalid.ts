/** @GQLType */
class Query {
  // No fields
}

class Foo {}

/** @GQLField */
export function greeting(query: Foo): string {
  return "Hello world!";
}
