/** @gqlType */
type Query = unknown;

/** @gqlField */
export function promiseOfPromise(_: Query): Promise<Promise<string>> {
  return promiseOf(promiseOf("Hello world!"));
}

/** @gqlField */
export function promiseOfPromisePromise(
  _: Query,
): Promise<Promise<Promise<string>>> {
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
