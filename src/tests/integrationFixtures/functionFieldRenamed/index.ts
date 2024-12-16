/** @gqlQueryField hello */
export function notHello(): string {
  return "Hello World";
}

export const query = `
    query {
      hello
    }
  `;
