import * as ts from "typescript";
import { DiagnosticsResult } from "./DiagnosticError";

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

export type PromiseOrValue<T> = T | Promise<T>;

export function collectResults<T>(
  results: DiagnosticsResult<T>[],
): DiagnosticsResult<T[]> {
  const errors: ts.DiagnosticWithLocation[] = [];
  const values: T[] = [];
  for (const result of results) {
    if (result.kind === "ERROR") {
      errors.push(...result.err);
    } else {
      values.push(result.value);
    }
  }
  if (errors.length > 0) {
    return err(errors);
  }
  return ok(values);
}

export function concatResults<T, U, E>(
  result1: Result<T, E[]>,
  result2: Result<U, E[]>,
): Result<[T, U], E[]> {
  if (result1.kind === "ERROR" && result2.kind === "ERROR") {
    return err([...result1.err, ...result2.err]);
  }
  if (result1.kind === "ERROR") {
    return result1;
  }
  if (result2.kind === "ERROR") {
    return result2;
  }
  return ok([result1.value, result2.value]);
}
