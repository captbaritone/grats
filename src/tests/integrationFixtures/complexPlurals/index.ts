/** @gqlType */
type Query = unknown;

/** @gqlField */
export function arrayOfPromises(_: Query): Promise<string>[] {
  return [
    Promise.resolve("Hello"),
    Promise.resolve("World"),
    Promise.resolve("!"),
  ];
}

/** @gqlField */
export function arrayOfArrayOfPromises(_: Query): Promise<string>[][] {
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

/** @gqlField */
export async function* asyncIterableOfArrayOfPromises(
  _: Query,
): AsyncIterable<Promise<string>[]> {
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
