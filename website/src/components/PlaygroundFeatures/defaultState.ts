import { State } from "./store";

export const URL_VERSION = 1;

const CONTENT = `/** @gqlType */
type Query = unknown;

/**
 * A user in our kick-ass system!
 * @gqlType User
 */
export class UserResolver {
  /** @gqlField */
  name: string = "Alice";

  /**
   * A customizable greeting for the user
   * @gqlField
   */
  greeting(salutation: string = "Hello"): string {
    return \`\${salutation}, \${this.name}\`;
  }

  /** @gqlField */
  static me(_: Query): UserResolver {
    return new UserResolver();
  }
}

/**
 * @gqlField
 * @deprecated Please use \`me\` instead.
 */
export function viewer(_: Query): UserResolver {
  return new UserResolver();
}
`;

export const DEFAULT_STATE: State = {
  doc: CONTENT,
  config: {
    nullableByDefault: true,
    reportTypeScriptTypeErrors: true,
  },
  view: {
    outputOption: "sdl",
  },
  gratsResult: null,
  VERSION: URL_VERSION,
};
