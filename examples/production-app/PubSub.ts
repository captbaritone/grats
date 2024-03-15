import { createPubSub } from "graphql-yoga";

export type EventTypes = {
  postLiked: [postId: string];
  randomNumber: [number];
};

export const PubSub = createPubSub<EventTypes>();
