// Locate: Query.greeting(salutation:)
/** @gqlType */
type Query = unknown;

/** @gqlQueryField */
export function greeting(salutation: string): string {
  return `${salutation}, world!`;
}
