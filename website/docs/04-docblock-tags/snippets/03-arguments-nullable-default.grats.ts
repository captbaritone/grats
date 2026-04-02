/** @gqlQueryField */
export function greeting(name: string = "Max"): string {
  return `Hello, ${name}`;
}
