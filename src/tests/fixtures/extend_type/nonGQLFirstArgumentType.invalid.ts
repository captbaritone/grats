/** @GQLType */
class Query {
  // No fields
}

class Foo {}

/** @GQLExtendType */
export function greeting(query: Foo): string {
  return "Hello world!";
}
