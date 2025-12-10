## input

```ts title="killsParentOnExceptionReturnsNull/index.ts"
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
    // @ts-ignore
    return null;
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

```
{
  "errors": [
    {
      "message": "Cannot return null for non-nullable field User.alwaysThrowsKillsParentOnException.",
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