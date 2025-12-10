## input

```ts title="killsParentOnException/index.ts"
/** @gqlQueryField */
export function me(): User {
  return new User();
}

/** @gqlType */
class User {
  /**
   * @gqlField
   * @killsParentOnException
   */
  alwaysThrowsKillsParentOnException(): string {
    throw new Error("This error should kill User");
  }
}

export const query = `
  query {
    me {
      alwaysThrowsKillsParentOnException
    }
  }
`;
```

## Output

### Query Result

```json
{
  "errors": [
    {
      "message": "This error should kill User",
      "locations": [
        {
          "line": 4,
          "column": 7
        }
      ],
      "path": [
        "me",
        "alwaysThrowsKillsParentOnException"
      ]
    }
  ],
  "data": {
    "me": null
  }
}
```