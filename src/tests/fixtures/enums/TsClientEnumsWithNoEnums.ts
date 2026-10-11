// {"tsClientEnums": "enums.ts"}

// A project which asks for the enums module but defines no enums still gets
// the module, with nothing in it.

/** @gqlQueryField */
export function greeting(): string {
  return "hello";
}
