/**
 * # Welcome to GenericCorp's GraphQL Schema!
 *
 * This is root type of our system. Everything you need can be access from here.
 * @gqlType
 */
type Query = unknown;

/** @gqlQueryField */
export function greet(): string {
  return "Hello world";
}
