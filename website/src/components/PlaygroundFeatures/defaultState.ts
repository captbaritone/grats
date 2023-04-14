import { State } from "./store";

export const URL_VERSION = 1;

const CONTENT = `/** @gqlType */
export default class Query {
  /** @gqlField */
  me(): UserResolver {
    return new UserResolver();
  }
  /**
   * @gqlField
   * @deprecated Please use \`me\` instead.
   */
  viewer(): UserResolver {
    return new UserResolver();
  }
}

/**
 * A user in our kick-ass system!
 * @gqlType User
 */
class UserResolver {
  /** @gqlField */
  name: string = "Alice";

  /** @gqlField */
  greeting(args: { salutation: string }): string {
    return \`\${args.salutation}, \${this.name}\`;
  }
} `;

export const DEFAULT_STATE: State = {
  doc: CONTENT,
  config: {
    nullableByDefault: true,
    reportTypeScriptTypeErrors: true,
  },
  view: {
    showGratsDirectives: false,
  },
  gratsResult: null,
  VERSION: URL_VERSION,
};
