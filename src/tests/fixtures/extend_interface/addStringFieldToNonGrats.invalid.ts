type SomeNonGratsType = string;

/** @gqlField */
export function greeting(someType: SomeNonGratsType): string {
  return `Hello ${someType}!`;
}
