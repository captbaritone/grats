import { State } from "./store";

export const URL_VERSION = 1;

const CONTENT = `/** @gqlQueryField */
export function me(): UserResolver {
  return new UserResolver();
}

/**
 * @gqlQueryField
 * @deprecated Please use \`me\` instead.
 */
export function viewer(): UserResolver {
  return new UserResolver();
}

/**
 * A user in our kick-ass system!
 * @gqlType User
 */
class UserResolver {
  /** @gqlField */
  name: string = "Alice";

  /** @gqlField */
  greeting(salutation: string): string {
    return \`\${salutation}, \${this.name}\`;
  }
} `;

export const DEFAULT_STATE: State = {
  doc: CONTENT,
  config: {
    nullableByDefault: true,
    reportTypeScriptTypeErrors: true,
  },
  view: {
    outputOption: "sdl",
    showGratsDirectives: false,
  },
  gratsResult: null,
  VERSION: URL_VERSION,
};
