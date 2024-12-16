/** @gqlQueryField */
export function hello(): string {
  return "Hello World";
}

export const query = `
    query {
      hello
    }
  `;
