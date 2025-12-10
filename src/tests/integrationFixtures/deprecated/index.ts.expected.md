## input

```ts title="deprecated/index.ts"
/**
 * @gqlQueryField
 * @deprecated For reasons
 */
export function hello(): string {
  return "Hello World";
}

/**
 * @gqlQueryField
 * @deprecated
 */
export function goodBye(): string {
  return "Farewell World";
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