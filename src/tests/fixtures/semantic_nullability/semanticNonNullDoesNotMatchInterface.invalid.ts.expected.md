-----------------
INPUT
----------------- 
// { "strictSemanticNullability": true }

/** @gqlInterface */
interface IPerson {
  /** @gqlField */
  name(): string;
}

/** @gqlType */
export class User implements IPerson {
  __typename = "User" as const;
  /** @gqlField */
  // @ts-ignore
  name(): string | null {
    if (Math.random() < 0.5) {
      throw new Error("Stuff happens...");
    }
    return "Alice";
  }
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/semantic_nullability/semanticNonNullDoesNotMatchInterface.invalid.ts:6:11 - error: Interface field `User.name` expects a non-nullable type but `IPerson.name` is nullable.

6   name(): string;
            ~~~~~~

  src/tests/fixtures/semantic_nullability/semanticNonNullDoesNotMatchInterface.invalid.ts:14:11
    14   name(): string | null {
                 ~~~~~~~~~~~~~
    Related location
