/** @gqlScalar String */
export type MyUrl = string;

/** @gqlQueryField */
export function url(): MyUrl {
  return "https://example.com";
}
