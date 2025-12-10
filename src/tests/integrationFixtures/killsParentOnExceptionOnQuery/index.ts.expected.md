## input

```ts title="killsParentOnExceptionOnQuery/index.ts"
/**
 * @gqlQueryField
 * @killsParentOnException
 */
export function alwaysThrowsKillsParentOnException(): string {
  throw new Error("This error should kill Query");
}

/** @gqlQueryField */
export function hello(): string {
  return "Hello World";
}

export const query = `
  query {
    alwaysThrowsKillsParentOnException
    hello
  }
`;
```

## Output

```
{
  "errors": [
    {
      "message": "This error should kill Query",
      "locations": [
        {
          "line": 3,
          "column": 5
        }
      ],
      "path": [
        "alwaysThrowsKillsParentOnException"
      ]
    }
  ],
  "data": null
}
```