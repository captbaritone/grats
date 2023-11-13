import { Context } from "./context";
import User from "./models/User";

/**
 * @gqlType
 */
export type Query = unknown;


/**
 * @gqlField users
 */
export function usersQueries(_: Query): UserQueries {
  return {}
}

/**
 * @gqlType
 */
export type UserQueries = {};

/** @gqlField */
export async function list(_: UserQueries, _args: {}, { userService }: Context): Promise<User[]> {
  return userService.listUsers().then(users => users.map(user => new User(user.id, user)));
}

/** @gqlField */
export async function byId(_: UserQueries, { id }: { id: string }, { userService }: Context): Promise<User> {
  return userService.getUser(id).then(user => new User(user.id, user))
}

/**
 * @gqlType
 */
export type Mutation = unknown;

/**
 * @gqlInput
 */
export type UserDataInput = { name: string };

/**
 * @gqlField
 */
export async function addUser(_: Mutation, { userData }: { userData: UserDataInput }, { userService }: Context): Promise<User> {
  return userService.addUser(userData).then(user => new User(user.id, user))
}

/**
 * @gqlField
 */
export async function updateUser(_: Mutation, { id, userData }: { id: string; userData: UserDataInput }, { userService }: Context): Promise<User> {
  return userService.updateUser(id, userData).then(user => new User(user.id, user))
}

/**
 * @gqlField
 */
export async function removeUser(_: Mutation, { id }: { id: string; }, { userService }: Context): Promise<string> {
  return userService.removeUser(id).then(() => id);
}