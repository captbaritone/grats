## input

```ts title="nonNullableListIncludesNull/index.ts"
/** @gqlQueryField */
export function someList(): string[] {
  // @ts-ignore
  return ["a", null, "b"];
}

/** @gqlQueryField */
export function someListOfLists(): string[][] {
  // @ts-ignore
  return [["a"], ["b", null, "c"]];
}

export const query = `
  query {
    someList
    someListOfLists
  }
`;
```

## Output

```
{
  "errors": [
    {
      "message": "Cannot return null for non-nullable field Query.someList.",
      "locations": [
        {
          "line": 3,
          "column": 5
        }
      ],
      "path": [
        "someList",
        1
      ]
    },
    {
      "message": "Cannot return null for non-nullable field Query.someListOfLists.",
      "locations": [
        {
          "line": 4,
          "column": 5
        }
      ],
      "path": [
        "someListOfLists",
        1,
        1
      ]
    }
  ],
  "data": {
    "someList": null,
    "someListOfLists": null
  }
}
```