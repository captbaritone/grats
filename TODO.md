# TODO

## Alpha
- [ ] Ensure `__typename`?
- [ ] More literals
    - [ ] Int
    - [ ] Float
    - [ ] Boolean
    - [ ] String
    - [ ] Enum
    - [ ] List
    - [ ] Object
    - [ ] Null
- [ ] Mutations and Query fields as functions
- [ ] Define types from type literals
- [ ] Extend interfaces
    - [ ] interface types implement interfaces
    - [ ] interface interfaces implement interfaces
- [ ] Allow interfaces to specify resolveType
- [ ] Args with defaults should be nullable?
- [ ] Optional args must include `null` as an option, since GraphQL JS may send that.

## Beta
- [ ] Support generic directives 
    - [ ] How do we handle arguments?
    - [ ] Same as defaults?
- [ ] Try converting the Star Wars example server
- [ ] Better error message for non GraphQL types.
- [ ] Split out docs into multipe files
- [ ] Extract error messages to a separate file
- [ ] Validate that we don't shadow builtins
- [ ] Parse directives from all docblocks and attach them to the schema
    - [ ] This will help catch places where people are using directives like @deprecated in unsupported positions
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
    - Could we surface TS errors?
- [ ] Can we ensure the context and ast arguments of resolvers are correct?
- [ ] Can we use TypeScript's inference to infer types?
    - [ ] For example, a method which returns a string, or a property that has a default value.
- [ ] Define resolvers?
- [ ] Generate tasks from playground
- [ ] LSP/VSCode Extension
  - [ ] See SDL on hover?
- [ ] Websites
- [ ] Support positional arguments
- [ ] Rename arguments
- [ ] Support descriptions on enums defined using union types. TS does not support docblock attachements on union types.
- [ ] Short links in errors for more info and links to docs/guides.
