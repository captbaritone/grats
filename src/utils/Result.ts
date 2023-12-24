import * as ts from "typescript";
import { DiagnosticsResult } from "./DiagnosticError";

/**
 * Result provides an interface for the result of fallible operations.
 *
 * It is similar to Rust's Result type in that it supports monadic chaining
 * (mapping).
 *
 * Practically speaking, it's modeled to the type system as a union in order to
 * allow for discrimination of the result type. However, to the user it presents as
 * a single class with a state ("OK" or "ERROR") and mapper methods.
 */
export type Result<T, E> = Ok<T> | Err<E>;

// Create a new `Result` in an OK state.
export function ok<T>(value: T): Ok<T> {
  return new Ok(value);
}
// Create a new `Result` in an ERROR state.
export function err<E>(err: E): Err<E> {
  return new Err(err);
}

// Private interface just to ensure both variants
// implement the same methods. Outside of this module the `Result` type should
// be used.
interface IResult<T, E> {
  kind: "OK" | "ERROR";
  map<T2>(fn: (t: T) => T2): Result<T2, E>;
  andThen<U, E2>(fn: (t: T) => Result<U, E2>): Result<U, E | E2>;
  mapErr<E2>(fn: (e: E) => E2): Result<T, E2>;
}

class Ok<T> implements IResult<T, unknown> {
  kind = "OK" as const;
  constructor(public value: T) {}
  map<T2>(fn: (t: T) => T2): Ok<T2> {
    return new Ok(fn(this.value));
  }
  andThen<U, E>(fn: (t: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }
  mapErr(): Ok<T> {
    return this;
  }
}

class Err<E> implements IResult<unknown, E> {
  kind = "ERROR" as const;
  constructor(public err: E) {}
  map(): Err<E> {
    return this;
  }
  andThen(): Err<E> {
    return this;
  }
  mapErr<E2>(fn: (e: E) => E2): Err<E2> {
    return new Err(fn(this.err));
  }
}

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
