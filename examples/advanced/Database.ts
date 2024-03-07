import { VC } from "./ViewerContext";

/**
 * This module is intended to represent a database.
 *
 * Note that we purposefully thead the VC all the way through to the database
 * layer so that we can do permission checks and access logging at the lowest
 * possible layer
 */
export type UserRow = {
  id: string;
  name: string;
};

export type PostRow = {
  id: string;
  authorId: string;
  title: string;
  content: string;
};

const MOCK_USERS: UserRow[] = [
  { id: "1", name: "Alice" },
  { id: "2", name: "Bob" },
  { id: "3", name: "Charlie" },
];

const MOCK_POSTS: PostRow[] = [
  {
    id: "1",
    authorId: "1",
    title: "Hello, World!",
    content: "This is my first post.",
  },
  {
    id: "2",
    authorId: "2",
    title: "My favorite things",
    content: "Here are some things I like.",
  },
  {
    id: "3",
    authorId: "3",
    title: "I'm back",
    content: "I was away for a while.",
  },
  {
    id: "4",
    authorId: "1",
    title: "Hello again",
    content: "I'm back too.",
  },
  {
    id: "5",
    authorId: "2",
    title: "My favorite things 2",
    content: "Here are some more things I like.",
  },
];

export async function selectPosts(vc: VC): Promise<Array<PostRow>> {
  vc.log("DB query: selectPosts");
  return MOCK_POSTS;
}

export async function createPost(
  vc: VC,
  draft: {
    authorId: string;
    title: string;
    content: string;
  },
): Promise<PostRow> {
  vc.log(`DB query: createPost: ${JSON.stringify(draft)}`);
  const id = (MOCK_POSTS.length + 1).toString();
  const row = { id, ...draft };
  MOCK_POSTS.push(row);
  return row;
}

export async function selectPostsWhereAuthor(
  vc: VC,
  authorId: string,
): Promise<Array<PostRow>> {
  vc.log(`DB query: selectPostsWhereAuthor: ${authorId}`);
  return MOCK_POSTS.filter((post) => post.authorId === authorId);
}

export async function selectUsers(vc: VC): Promise<Array<UserRow>> {
  vc.log("DB query: selectUsers");
  return MOCK_USERS;
}

export async function getPostsByIds(
  vc: VC,
  ids: readonly string[],
): Promise<Array<PostRow>> {
  vc.log(`DB query: getPostsByIds: ${ids.join(", ")}`);
  return ids.map((id) => MOCK_POSTS.find((post) => post.id === id)!);
}

export async function getUsersByIds(
  vc: VC,
  ids: readonly string[],
): Promise<Array<UserRow>> {
  vc.log(`DB query: getUsersByIds: ${ids.join(", ")}`);
  return ids.map((id) => MOCK_USERS.find((user) => user.id === id)!);
}
