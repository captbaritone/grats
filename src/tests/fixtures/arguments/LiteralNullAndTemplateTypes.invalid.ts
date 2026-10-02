/** @gqlType */
export default class SomeType {
  /** @gqlField */
  nullArg(arg: null): string {
    return "";
  }

  /** @gqlField */
  templateArg(arg: `hello`): string {
    return "";
  }

  /** @gqlField */
  substitutionArg(arg: `hello ${string}`): string {
    return "";
  }

  /** @gqlField */
  nullField: null;

  /** @gqlField */
  templateField: `hello`;
}
