/** @gqlUnion */
// highlight-start
export type Result<T> = T | MyError;
// highlight-end

/** @gqlField */
// highlight-start
export function myValue(_: Query): Result<MyValue> {
  // highlight-end
  try {
    return getMyValue();
  } catch (e) {
    return { message: e.message, __typename: "MyError" };
  }
}

/** @gqlField */
// highlight-start
export function myOtherValue(_: Query): Result<MyOtherValue> {
  // highlight-end
  try {
    return getMyOtherValue();
  } catch (e) {
    return { message: e.message, __typename: "MyError" };
  }
}
// trim-start

/** @gqlType */
export type MyValue = {
  __typename: "MyValue";
  /** @gqlField */
  value: string;
};

/** @gqlType */
export type MyOtherValue = {
  __typename: "MyOtherValue";
  /** @gqlField */
  value: string;
};

/** @gqlType */
export type MyError = {
  __typename: "MyError";
  /** @gqlField */
  message: string;
};

/** @gqlType */
type Query = unknown;

function getMyValue(): MyValue {
  return { value: "Hello, World!", __typename: "MyValue" };
}

function getMyOtherValue(): MyOtherValue {
  return { value: "Hello, World!", __typename: "MyOtherValue" };
}
// trim-end
