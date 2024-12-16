/** @gqlQueryField */
export function greeting(): string {
  return "Hello world";
}

/**
 * I might want to explicitly define a type here to provide a description.
 *
 * @gqlType */
export type Query = unknown;
