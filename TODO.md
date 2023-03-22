# TODO

## Alpha
- [ ] Rewrite pitch/description 
- [ ] Decouple from file system
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
- [ ] Build a playground
    - Code on left, GraphQL on right
    - Could we actually evaluate the resolvers? Maybe in a worker?
    - Could we hook up GraphiQL 2?
    - Could we surface TS errors?
- [ ] Table of contents for docs

## Beta
- [ ] Classes as interfaces. Classes which extend this interface will implement it in GraphQL.
- [ ] Support generic directives 
    - [ ] How do we handle arguments?
    - [ ] Same as defaults?
- [ ] Try converting the Star Wars example server
- [ ] Better error message for non GraphQL types.
- [ ] A name
- [ ] Split out docs into multipe files
- [ ] Extract error messages to a separate file
- [ ] Mutations and Query fields as functions
- [ ] Validate that we don't shadow builtins
- [ ] Parse directives from all docblocks and attach them to the schema
    - [ ] This will help catch places where people are using directives like @deprecated in unsupported positions
- [ ] Add header to generated schema file indicating it was generated.
- [ ] Add option to print sorted schema.
- [ ] Better capture ranges form GraphQL errors

## Future
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
