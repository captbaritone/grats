import { ID } from "grats";
import { getSchema } from "./schema"; // Generated by Grats

/**
 * A user role
 * @gqlEnum
 */
enum Role {
  Admin = "Admin",
  User = "User",
}

/** @gqlType */
type User = {
  /** @gqlField */
  id: ID;
  /** @gqlField */
  role: Role;
  /** @gqlField */
  name: string;
};

const users: User[] = [
  { id: "1", role: Role.Admin, name: "Sikan" },
  { id: "2", role: Role.User, name: "Nicole" },
];

interface GqlContext {
  viewerId: number;
  users: User[];
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function userById(
  _: Query,
  args: { id: string },
  ctx: GqlContext,
): User | null {
  return users.find((u) => u.id === args.id) || null;
}

const schema = getSchema();
