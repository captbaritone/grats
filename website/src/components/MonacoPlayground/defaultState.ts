import { State, getDefaultPlaygroundConfig } from "./State";

export const URL_VERSION = 1;

const CONTENT = `/** @gqlQueryField */
export function me(): User {
  return new User();
}

/**
 * A user in our kick-ass system!
 * @gqlType
 */
class User {
  /** @gqlField */
  name: string = "Alice";

  /** @gqlField */
  greeting(salutation: string): string {
    return \`\${salutation}, \${this.name}\`;
  }
}`;

export const DEFAULT_STATE: State = {
  doc: CONTENT,
  config: getDefaultPlaygroundConfig(),
  view: {
    outputOption: "sdl",
    showGratsDirectives: false,
  },
  VERSION: URL_VERSION,
};
