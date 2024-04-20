// {"importModuleSpecifierEnding": ".js"}

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: string;
}

/** @gqlField */
export function greeting(t: SomeType): string {
  return t.hello + " world!";
}
