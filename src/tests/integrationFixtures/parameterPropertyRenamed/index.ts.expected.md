## input

```ts title="parameterPropertyRenamed/index.ts"
/** @gqlQueryField */
export function me(): User {
  return new User();
}

/** @gqlType */
class User {
  constructor(
    /** @gqlField hello */
    public NOT_THIS: string = "world",
  ) {}
}

export const query = `
  query {
    me {
      hello
    }
  }
`;
```

## Output

```
{
  "data": {
    "me": {
      "hello": "world"
    }
  }
}
```