import { v4 as uuidv4 } from "uuid";

export type UserData = { name: string; groupIDs: string[] };
export type User = { id: string } & UserData;
export type GroupData = { name: string; description: string };
export type Group = { id: string } & GroupData;

/** This is an in-memory database, for illustrative purposes */
const GROUPS_BY_ID: Record<string, Group> = (() => {
  const id = uuidv4();
  return { [id]: { id, name: "Pal's Club", description: "A group of people" } };
})();

/** This is an in-memory database, for illustrative purposes */
const USERS_BY_ID: Record<string, User> = (() => {
  const id = uuidv4();
  const id2 = uuidv4();
  return {
    [id]: { id, name: "Alice", groupIDs: Object.keys(GROUPS_BY_ID) },
    // A duplicate "Alice" is needed just for the integration tests
    [id2]: { id: id2, name: "Alice", groupIDs: [] },
  };
})();

function userNotFoundError(id: string): Error {
  return new Error(`User with ID "${id}" was not found`);
}

function groupNotFoundError(id: string): Error {
  return new Error(`Group with ID "${id}" was not found`);
}

export class UserService {
  async listUsers(): Promise<User[]> {
    return Object.values(USERS_BY_ID);
  }

  async getUser(id: string): Promise<User> {
    const user = USERS_BY_ID[id];
    if (!user) {
      throw userNotFoundError(id);
    }
    return user;
  }

  async addUser(userData: UserData): Promise<User> {
    const id = uuidv4();
    const user = (USERS_BY_ID[id] = { id, ...userData });
    return user;
  }

  async removeUser(id: string): Promise<void> {
    delete USERS_BY_ID[id];
  }

  async updateUser(id: string, userData: Partial<UserData>): Promise<User> {
    const user = USERS_BY_ID[id];
    if (!user) {
      throw userNotFoundError(id);
    }
    return Object.assign(
      user,
      // Remove nullish entries
      Object.fromEntries(
        Object.entries(userData).filter(
          ([_, v]) => v !== null && v !== undefined,
        ),
      ),
    );
  }
}

export class GroupService {
  async listGroups(): Promise<Group[]> {
    return Object.values(GROUPS_BY_ID);
  }

  async getGroup(id: string): Promise<Group> {
    const group = GROUPS_BY_ID[id];
    if (!group) {
      throw groupNotFoundError(id);
    }
    return group;
  }

  async addGroup(groupData: GroupData): Promise<Group> {
    const id = uuidv4();
    const group = (GROUPS_BY_ID[id] = { id, ...groupData });
    return group;
  }

  async removeGroup(id: string): Promise<void> {
    delete GROUPS_BY_ID[id];
  }

  async updateGroup(id: string, groupData: Partial<GroupData>): Promise<Group> {
    const group = GROUPS_BY_ID[id];
    if (!group) {
      throw userNotFoundError(id);
    }
    return Object.assign(
      group,
      // Remove nullish entries
      Object.fromEntries(
        Object.entries(groupData).filter(
          ([_, v]) => v !== null && v !== undefined,
        ),
      ),
    );
  }
}

export type Context = {
  userService: UserService;
  groupService: GroupService;
};
