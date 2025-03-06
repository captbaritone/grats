/** @gqlQueryField */
export function hello(greeting: string = "Hello"): string {
  return `${greeting}, world!`;
}

export const query = `
    query {
      hello
    }
  `;
