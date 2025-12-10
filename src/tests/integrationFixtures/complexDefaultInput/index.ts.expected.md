## input

```ts title="complexDefaultInput/index.ts"
/**
 * @gqlInput
 */
type SomeObj = {
  a: string;
};

/**
 * @gqlQueryField
 */
export function hello({
  someObj = { a: "Sup" },
}: {
  someObj: SomeObj;
}): string {
  return someObj.a;
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
    "hello": "Sup"
  }
}
```