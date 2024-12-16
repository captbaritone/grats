/** @gqlUnion */
export type MyValueResult = MyValue | MyError;

/** @gqlQueryField */
export function myValue(): MyValueResult {
  try {
    return getMyValue();
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
export type MyError = {
  __typename: "MyError";
  /** @gqlField */
  message: string;
};

function getMyValue(): MyValue {
  return { value: "Hello, World!", __typename: "MyValue" };
}
// trim-end
