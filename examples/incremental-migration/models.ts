import { ID } from "grats";
import { faker } from "@faker-js/faker";
faker.seed(123);

/**
 * The model layer of a GraphQL layer where one type is in the process of being
 * incrementally migrated to Grats.
 *
 * Migrated so far:
 * - Query.user
 * - User.firstName
 * - User.lastName
 * - User.fullName
 * - User.id
 */

/** @gqlQueryField */
export function user(id: ID): User | undefined {
  return Users.get(id);
}

/** @gqlType */
export class User {
  /** @gqlField */
  firstName: string;
  /** @gqlField */
  lastName: string;
  /** @gqlField */
  id: ID;
  constructor(id: string) {
    this.id = id;
    this.firstName = faker.person.firstName();
    this.lastName = faker.person.lastName();
  }
  /** @gqlField */
  fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}

export class Post {
  id;
  authorId;
  title;
  content;
  constructor(id: string) {
    this.id = id;
    this.authorId = String(faker.number.int({ min: 1, max: 100 }));
    this.title = faker.lorem.text();
    this.content = faker.lorem.paragraphs(2);
  }
}

export class Comment {
  id;
  postId;
  authorId;
  comment;
  constructor(id: string) {
    this.id = id;
    this.authorId = String(faker.number.int({ min: 1, max: 100 }));
    this.postId = String(faker.number.int({ min: 1, max: 100 }));
    this.comment = faker.lorem.text();
  }
}

// ==== DATA ====

export const Users = new Map<string, User>();
export const Posts = new Map<string, Post>();
export const Comments = new Map<string, Comment>();

// Create 100 users, posts and comments
for (let i = 1; i <= 100; i += 1) {
  Users.set(String(i), new User(String(i)));
  Posts.set(String(i), new Post(String(i)));
  Comments.set(String(i), new Comment(String(i)));
}
