## input

```ts title="promiseOfPromise/index.ts"
/** @gqlQueryField */
export function promiseOfPromise(): Promise<Promise<string>> {
  return promiseOf(promiseOf("Hello world!"));
}

/** @gqlQueryField */
export function promiseOfPromisePromise(): Promise<Promise<Promise<string>>> {
  return promiseOf(promiseOf(promiseOf("Hello world!")));
}

function promiseOf<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    resolve(value);
  });
}

export const query = `
  query {
    promiseOfPromise
    promiseOfPromisePromise
  }`;
```

## Output

### Query Result

```json
{
  "data": {
    "promiseOfPromise": "Hello world!",
    "promiseOfPromisePromise": "Hello world!"
  }
}
```