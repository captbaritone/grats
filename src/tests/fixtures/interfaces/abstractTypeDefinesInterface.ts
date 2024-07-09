import { ID } from "../../../Types";

/** @gqlInterface Node */
abstract class GraphQLNode {
  __typename: string;
  localId: string;

  /**
   * @gqlField
   * @killsParentOnException
   */
  id(): ID {
    return window.btoa(this.__typename + ":" + this.localId);
  }
}

/** @gqlType */
class User extends GraphQLNode {
  __typename: "User";
  constructor(
    public localId: string,
    /** @gqlField */
    public name: string,
  ) {
    super();
  }
}
