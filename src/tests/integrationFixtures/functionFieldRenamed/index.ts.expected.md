## input

```ts title="functionFieldRenamed/index.ts"
/** @gqlQueryField hello */
export function notHello(): string {
  return "Hello World";
}

export const query = `
    query {
      hello
    }
  `;
```

## Output

```
{
  "data": {
    "hello": "Hello World"
  }
}
```