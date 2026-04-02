import { GqlInfo } from "grats";

/** @gqlQueryField */
// highlight-start
export function greeting(info: GqlInfo): string {
  // highlight-end
  return `Greetings from the ${info.fieldName} field!`;
}
