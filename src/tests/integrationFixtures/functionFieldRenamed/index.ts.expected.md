# functionFieldRenamed/index.ts

## Input

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

### Query Result

```json
{
  "data": {
    "hello": "Hello World"
  }
}
```