import { Users, Posts, Comments, User, Post, Comment } from "../models";
import SchemaBuilder from "@pothos/core";
const builder = new SchemaBuilder({});

/**
 * A Pothos GraphQL schema that is in the process of being incrementally
 * migrated to Grats. Fields which have already been migrated are commented out
 * and replaced by annotations, methods and functions added in `../models.ts`.
 */

builder.objectType(User, {
  name: "User",
  fields: (t) => ({
    // These fields have already been migrated to Grats

    // id: t.exposeID("id"),
    // firstName: t.exposeString("firstName"),
    // lastName: t.exposeString("lastName"),
    // fullName: t.string({
    //  resolve: (user) => `${user.firstName} ${user.lastName}`,
    // }),
    posts: t.field({
      type: [Post],
      resolve: (user) =>
        [...Posts.values()].filter((post) => post.authorId === user.id),
    }),
    comments: t.field({
      type: [Comment],
      resolve: (user) =>
        [...Comments.values()].filter(
          (comment) => comment.authorId === user.id,
        ),
    }),
  }),
});

builder.objectType(Post, {
  name: "Post",
  fields: (t) => ({
    id: t.exposeID("id"),
    title: t.exposeString("title"),
    content: t.exposeString("content"),
    author: t.field({
      type: User,
      nullable: true,
      resolve: (post) =>
        [...Users.values()].find((user) => user.id === post.authorId),
    }),
    comments: t.field({
      type: [Comment],
      resolve: (post) =>
        [...Comments.values()].filter((comment) => comment.postId === post.id),
    }),
  }),
});

builder.objectType(Comment, {
  name: "Comment",
  fields: (t) => ({
    id: t.exposeID("id"),
    comment: t.exposeString("comment"),
    author: t.field({
      type: User,
      nullable: true,
      resolve: (comment) =>
        [...Users.values()].find((user) => user.id === comment.authorId),
    }),
    post: t.field({
      type: Post,
      resolve: (comment) =>
        [...Posts.values()].find((post) => post.id === comment.postId)!,
    }),
  }),
});

const DEFAULT_PAGE_SIZE = 10;

builder.queryType({
  fields: (t) => ({
    post: t.field({
      type: Post,
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (root, args) => Posts.get(String(args.id)),
    }),
    posts: t.field({
      type: [Post],
      args: {
        take: t.arg.int(),
        skip: t.arg.int(),
      },
      resolve: (root, { skip, take }) =>
        [...Posts.values()].slice(
          skip ?? 0,
          (skip ?? 0) + (take ?? DEFAULT_PAGE_SIZE),
        ),
    }),
    // This field has been migrated to Grats
    // user: t.field({
    //   type: User,
    //   nullable: true,
    //   args: {
    //     id: t.arg.id({ required: true }),
    //   },
    //   resolve: (root, args) => Users.get(String(args.id)),
    // }),
  }),
});

export const schema = builder.toSchema();
