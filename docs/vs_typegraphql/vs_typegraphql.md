## TypeGraphQL + Prisma

```diff
2d1
< import { ObjectType, Field, ID, buildSchemaSync } from "type-graphql";
8c7
< @ObjectType()
---
> /** @GQLType */
10c9
<   @Field()
---
>   /** @GQLField */
13c12
<   @Field((type) => String, { nullable: true })
---
>   /** @GQLField */
17,19c16,18
< @Resolver(User)
< export class UserResolver {
<   @Query((returns) => [User], { nullable: true })
---
> /** @GQLType */
> export class Query {
>   /** @GQLField */
```
