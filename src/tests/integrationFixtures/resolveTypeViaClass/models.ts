import { ID } from "../../../Types.js";

/** @gqlInterface */
export interface GqlNode {
  __typename: string;
  localID(): string;
}

/** @gqlField */
export function id(node: GqlNode): ID {
  return `${node.__typename}:${node.localID()}`;
}

/** @gqlType */
export default class DefaultNode implements GqlNode {
  __typename = "DefaultNode" as const;
  constructor(private _id: string) {}
  localID() {
    return this._id;
  }
  static fromId(id: string): DefaultNode {
    return new DefaultNode(id);
  }
}

/** @gqlType */
export class User implements GqlNode {
  __typename = "User" as const;
  constructor(private _id: string) {}
  localID() {
    return this._id;
  }
  static fromId(id: string): User {
    return new User(id);
  }
}

/** @gqlType RenamedNode */
export class ThisNameGetsIgnored implements GqlNode {
  __typename = "RenamedNode" as const;
  constructor(private _id: string) {}
  localID() {
    return this._id;
  }
  static fromId(id: string): ThisNameGetsIgnored {
    return new ThisNameGetsIgnored(id);
  }
}

/** @gqlType */
export class Guest implements GqlNode {
  __typename = "Guest" as const;
  constructor(private _id: string) {}
  localID() {
    return this._id;
  }
  static fromId(id: string): Guest {
    return new Guest(id);
  }
}
