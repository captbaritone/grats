-----------------
INPUT
----------------- 
/** @gqlContext */
type Ctx = {};

type SomeCtx = { name: string };

/** @gqlContext */
export function derived(): SomeCtx {
  return { name: "Roger" };
}

/** @gqlQueryField */
export function hello(someCtx: SomeCtx): string {
  return `Hello ${someCtx.name}`;
}

export const query = `
    query {
      hello
    }
  `;

-----------------
OUTPUT
-----------------
{
  "data": {
    "hello": "Hello Roger"
  }
}