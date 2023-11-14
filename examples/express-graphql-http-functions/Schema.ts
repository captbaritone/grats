import { Context } from "./context";
import IPerson from "./interfaces/IPerson";
import User from "./models/User";

/**
 * @gqlType
 */
export type Query = unknown;

/** @gqlField */
export async function allUsers(_: Query, _args: unknown, { userService }: Context): Promise<User[]> {
  return userService
    .listUsers()
    .then(users => users.map(user => new User(user.id, user)));
}

/** @gqlField */
export async function userById(_: Query, { id }: { id: string }, { userService }: Context): Promise<User> {
  return userService
    .getUser(id)
    .then(user => new User(user.id, user))
}

/** @gqlField */
export async function me(_: Query, _args: unknown, { userService }: Context): Promise<User> {
  return userService
    .listUsers()
    .then(users => users.slice(0, 1).map(user => new User(user.id, user))[0]);
}

/** @gqlField */
export async function person(_: Query, _args: unknown, { userService }: Context): Promise<IPerson> {
  return userService
    .listUsers()
    .then(users => users.slice(0, 1).map(user => new User(user.id, user))[0]);
}

/**
 * @gqlType
 */
export type Mutation = unknown;

/**
 * @gqlInput
 */
export type UserDataInput = { name: string, groupIDs?: string[] };

/**
 * @gqlField
 */
export async function addUser(_: Mutation, { userData }: { userData: UserDataInput }, { userService }: Context): Promise<User> {
  return userService
    .addUser({ groupIDs: [], ...userData })
    .then(user => new User(user.id, user))
}

/**
 * @gqlField
 */
export async function updateUser(_: Mutation, { id, userData }: { id: string; userData: UserDataInput }, { userService }: Context): Promise<User> {
  return userService
    .updateUser(id, userData)
    .then(user => new User(user.id, user))
}

/**
 * @gqlField
 */
export async function removeUser(_: Mutation, { id }: { id: string; }, { userService }: Context): Promise<string> {
  return userService.removeUser(id).then(() => id);
}
