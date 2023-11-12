import { v4 as uuidv4 } from 'uuid';

export type UserData = { name: string };
export type User = { id: string, } & UserData;

/** This is an in-memory database, for illustrative purposes */
const USERS_BY_ID: Record<string, { id: string, name: string }> = {};

function userNotFoundError(id: string): Error {
  return new Error(`User with ID "${id}" was not found`)
}

export class UserService {
  async listUsers(): Promise<User[]> {
    return Object.values(USERS_BY_ID)
  }
  
  async getUser(id: string): Promise<User> {
    const user = USERS_BY_ID[id];
    if (!user) {
      throw userNotFoundError(id)
    }
    return user;
  }

  async addUser(userData: UserData): Promise<User> {
    const id = uuidv4();
    const user = USERS_BY_ID[id] = { id, ...userData };
    return user;
  }

  async removeUser(id: string): Promise<void> {
    delete USERS_BY_ID[id];
  }

  async updateUser(id: string, userData: Partial<UserData>): Promise<User> {
    const user = USERS_BY_ID[id];
    if (!user) {
      throw userNotFoundError(id)
    }
    return Object.assign(user, userData);
  }
}

export type Context = {
  userService: UserService;
}
