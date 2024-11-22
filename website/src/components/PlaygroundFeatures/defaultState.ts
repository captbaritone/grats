import { State } from "./store";

export const URL_VERSION = 1;

const CONTENT = `/** @gqlType */
type Query = unknown;

/** @gqlField */
export function me(_: Query): UserResolver {
  return new UserResolver();
}

/**
 * @gqlField
 * @deprecated Please use \`me\` instead.
 */
export function viewer(_: Query): UserResolver {
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
  ts: null,
  gratsResult: null,
  VERSION: URL_VERSION,
};
