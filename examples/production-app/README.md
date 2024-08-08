# Production App Example

This example includes a relatively fully featured app to demonstrate how real-world applications can be built with Grats.

## Features

- [Node interface](https://graphql.org/learn/global-object-identification/)
- [dataloader](https://github.com/graphql/dataloader)
- [Connections](https://relay.dev/graphql/connections.htm) (as used by Relay)
- Subscriptions - See `Subscription.postLikes` in `models/LikeConnection.ts`
- `@stream` - For expensive lists like `Viewer.feed` in `models/Viewer.ts`
- Custom scalars - See `Date` defined in `graphql/CustomScalars.ts`
- OneOf input types for modeling Markdown content in `models/Post.ts`

## Implementation notes

DataLoaders are attached to the per-request viewer context. This enables per-request caching while avoiding the risk of leaking data between requests/users.

The viewer context (VC) is passed all the way through the app to the data layer. This would enable permission checking to be defined as close to the data as possible. Additionally, the VC is stashed on each model instance, enabling the model create edges to other models without needing to get a new VC.

## Running the demo

- `$ pnpm install`
- `$ pnpm run start`
