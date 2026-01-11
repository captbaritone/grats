# functionField/index.ts

## Input

```ts title="functionField/index.ts"
/** @gqlQueryField */
export function hello(): string {
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