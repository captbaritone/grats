# TODO

## Alpha
- [ ] Don't report name collisions as merged interfaces (class + interface with the same name)
- [ ] Test and clarify behavior of killsParentOnException
    - [ ] Should there be a way to enable killsParentOnException for nullable resolvers?
- [ ] Args with defaults should be nullable?
- [ ] Optional args must include `null` as an option, since GraphQL JS may send that.
- [ ] Allow type literal types to implement interfaces
- [ ] Add more robust config validation
- [ ] Allow property types to be functions
- [ ] Allow `Promise<T> | T`
- [ ] Write guides
  - [ ] DataLoader pattern
  - [ ] Subscriptions
- [ ] Playground does not support promises
- [ ] Collect deprecated tags on all nodes and let GraphQL validation report an error

## Beta
- [ ] Support generic directives 
    - [ ] How do we handle arguments?
    - [ ] Same as defaults?
- [ ] Try converting the Star Wars example server
- [ ] Better error message for non GraphQL types.
- [ ] Validate that we don't shadow builtins
- [ ] Add header to generated schema file indicating it was generated.
- [ ] Add option to print sorted schema.

## Examples, Guides and Documentation
- [ ] Add a guide for using with Apollo Server
- [ ] Add a guide for using with Express-graphql
- [ ] Add a guide for OOP style
- [ ] Add a guide for functional style
- [ ] Comparison to Nexus
- [ ] Comparison to Pothos
- [ ] Comparison to TypeGraphQL
- [ ] Migration guide from Nexus
- [ ] Migration guide from Pothos
- [ ] Migration guide from TypeGraphQL
- [ ] Post about what it means to be "True" code-first

## Future
- [ ] Improve playground
    - Could we actually evaluate the resolvers? Maybe in a worker?
    - Could we hook up GraphiQL 2?
- [ ] Can we ensure the context and ast arguments of resolvers are correct?
- [ ] Can we use TypeScript's inference to infer types?
    - [ ] For example, a method which returns a string, or a property that has a default value.
- [ ] Define resolvers?
- [ ] Generate tasks from playground
- [ ] TypeScript plugin?
- [ ] LSP/VSCode Extension
  - [ ] See SDL on hover?
- [ ] Websites
- [ ] Support positional arguments
- [ ] Rename arguments
- [ ] Support descriptions on enums defined using union types. TS does not support docblock attachements on union types.
- [ ] Short links in errors for more info and links to docs/guides.
