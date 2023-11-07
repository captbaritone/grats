import { Float as LocalFloat } from "../../../Types";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  ratio(): LocalFloat {
    return 10;
  }
}
