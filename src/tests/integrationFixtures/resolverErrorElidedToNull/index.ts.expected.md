## input

```ts title="resolverErrorElidedToNull/index.ts"
/** @gqlQueryField */
export function alwaysThrows(): string {
  throw new Error("This should null out the field");
}

export const query = `
  query {
    alwaysThrows
  }
`;
```

## Output

### Query Result

```json
{
  "errors": [
    {
      "message": "This should null out the field",
      "locations": [
        {
          "line": 3,
          "column": 5
        }
      ],
      "path": [
        "alwaysThrows"
      ]
    }
  ],
  "data": {
    "alwaysThrows": null
  }
}
```