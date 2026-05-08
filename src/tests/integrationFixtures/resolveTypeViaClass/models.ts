import { ID } from "../../../Types.js";
import { getTypeName } from "./schema.js";

/** @gqlInterface */
export interface GqlNode {
  localID(): string;
}

/** @gqlField */
export function id(node: GqlNode): ID {
  return `${getTypeName(node)}:${node.localID()}`;
}

/** @gqlType */
export default class DefaultNode implements GqlNode {
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
  constructor(private _id: string) {}
  localID() {
    return this._id;
  }
  static fromId(id: string): Guest {
    return new Guest(id);
  }
}
