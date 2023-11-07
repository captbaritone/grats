/** @gqlType */
class SomeType {
  /** @gqlField */
  foo: string;
}

/** @gqlInterface */
interface IFoo {
  /** @gqlField */
  bar: string;
}

/** @gqlField */
export function greeting(iFoo: IFoo): string {
  return "Hello world!";
}
