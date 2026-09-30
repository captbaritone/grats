export type Result<T, E> = Ok<T> | Err<E>;

type Ok<T> = { kind: "OK"; value: T };
type Err<E> = { kind: "ERROR"; err: E };

// Create a new `Result` in an OK state.
export function ok<T>(value: T): Ok<T> {
  return { kind: "OK", value };
}
// Create a new `Result` in an ERROR state.
export function err<E>(err: E): Err<E> {
  return { kind: "ERROR", err };
}

/**
 * Helper class for chaining together a series of `Result` operations.
 */
export class ResultPipe<T, E> {
  constructor(private readonly _result: Result<T, E>) {}
  // Transform the value if OK, otherwise return the error.
  map<T2>(fn: (value: T) => T2): ResultPipe<T2, E> {
    if (this._result.kind === "OK") {
      return new ResultPipe(ok(fn(this._result.value)));
    }
    return new ResultPipe(this._result);
  }
  // Transform the error if ERROR, otherwise return the value.
  mapErr<E2>(fn: (e: E) => E2): ResultPipe<T, E2> {
    if (this._result.kind === "ERROR") {
      return new ResultPipe(err(fn(this._result.err)));
    }
    return new ResultPipe(this._result);
  }
  // Transform the value into a new result if OK, otherwise return the error.
  // The new result may have a new value type, but must have the same error
  // type.
  andThen<U>(fn: (value: T) => Result<U, E>): ResultPipe<U, E> {
    if (this._result.kind === "OK") {
      return new ResultPipe(fn(this._result.value));
    }
    return new ResultPipe(this._result);
  }
  // Return the result
  result(): Result<T, E> {
    return this._result;
  }
}
