import { State } from "./store";

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
  config: {
    nullableByDefault: true,
    reportTypeScriptTypeErrors: true,
    importModuleSpecifierEnding: "",
  },
  view: {
    outputOption: "sdl",
    showGratsDirectives: false,
  },
  gratsResult: null,
  VERSION: URL_VERSION,
};
