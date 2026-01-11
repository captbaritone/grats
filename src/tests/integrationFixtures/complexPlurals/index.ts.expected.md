# complexPlurals/index.ts

## Input

```ts title="complexPlurals/index.ts"
/** @gqlQueryField */
export function arrayOfPromises(): Promise<string>[] {
  return [
    Promise.resolve("Hello"),
    Promise.resolve("World"),
    Promise.resolve("!"),
  ];
}

/** @gqlQueryField */
export function arrayOfArrayOfPromises(): Promise<string>[][] {
  return [
    [Promise.resolve("Hello"), Promise.resolve("World"), Promise.resolve("!")],
    [
      Promise.resolve("Hello"),
      Promise.resolve("World"),
      Promise.resolve("again"),
      Promise.resolve("!"),
    ],
  ];
}

/** @gqlQueryField */
export async function* asyncIterableOfArrayOfPromises(): AsyncIterable<
  Promise<string>[]
> {
  yield [
    Promise.resolve("Hello"),
    Promise.resolve("World"),
    Promise.resolve("!"),
  ];
  yield [
    Promise.resolve("Hello"),
    Promise.resolve("World"),
    Promise.resolve("again"),
    Promise.resolve("!"),
  ];
}

export const query = `
    query {
      arrayOfPromises
      arrayOfArrayOfPromises
      # TODO: Should this work?
      # asyncIterableOfArrayOfPromises
    }
  `;
```

## Output

### Query Result

```json
{
  "data": {
    "arrayOfPromises": [
      "Hello",
      "World",
      "!"
    ],
    "arrayOfArrayOfPromises": [
      [
        "Hello",
        "World",
        "!"
      ],
      [
        "Hello",
        "World",
        "again",
        "!"
      ]
    ]
  }
}
```