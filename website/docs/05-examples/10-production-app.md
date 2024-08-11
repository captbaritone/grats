# Production App

This example includes a relatively fully featured app to demonstrate how real-world applications can be built with Grats.

**https://github.com/captbaritone/grats/tree/main/examples/production-app/**

## Features

- [Node interface](https://graphql.org/learn/global-object-identification/)
- [dataloader](https://github.com/graphql/dataloader)
- [Connections](https://relay.dev/graphql/connections.htm) (as used by Relay)
- Subscriptions - See `Subscription.postLikes` in `models/LikeConnection.ts`
- `@stream` - For expensive lists like `Viewer.feed` in `models/Viewer.ts`
- Custom scalars - See `Date` defined in `graphql/CustomScalars.ts`
- [OneOf input types](../04-docblock-tags/10-oneof-inputs.mdx) for modeling Markdown content in `models/Post.ts`
- Look-ahead optimization for Connections to use count query for requests that only read count in `graphql/gqlUtils.ts`.

## Implementation notes

Dataloaders are attached to the per-request viewer context. This enables per-request caching while avoiding the risk of leaking data between requests/users.

The viewer context is passed all the way through the app to the data layer. This would enable permission checking to be defined as close to the data as possible.

## Libraries used

- `graphql-yoga`
- `graphql-js`
- `dataloader`
- `@graphql-yoga/plugin-defer-stream`
- `graphql-relay`
