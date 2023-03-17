# TODO

## Alpha
- [ ] Escape hatches
    - [ ] `@graphql` directive
- [ ] Enable exhaustive switch statements
- [ ] Handle optional/non optional
    - [ ] Default: All fields are optional, there's a docblock to mark them as required (this asserts that the return type is non-nullable)
    - [ ] Configurable: Optionality is purely derived from the types
- [ ] Separate out scalar types
- [ ] Define unions
- [ ] Does GraphQLJS have types for a GraphQL Schema AST?
- [ ] Try converting the Star Wars example server
- [ ] Traverse all comments and check for ones in the wrong place
- [ ] Support directives (@deprecated etc)
- [ ] Extract descriptions
- [ ] Ensure `__typename`?
- [ ] Correctly handle optional ? arguments
- [ ] Correctly handle ? return types
- [ ] More literals
    - [ ] Int
    - [ ] Float
    - [ ] Boolean
    - [ ] String
    - [ ] Enum
    - [ ] List
    - [ ] Object
    - [ ] Null
- [ ] Support for enums (TS enums), maybe some other kinds?
- [ ] Classes as interfaces. Classes which extend this interface will implement it in GraphQL.
- [ ] What about nested input types?
- [ ] What about default values on input types?
- [ ] What about renaming fields on input types?

## Beta
- [ ] Better error message for non GraphQL types.
- [ ] A name
- [ ] Handle optional/non optional
    - [ ] Configurable: Optionality is purely derived from the types
- [ ] Define custom scalars
- [ ] Playground
- [ ] Docs
- [ ] Extract error messages to a separate file
- [ ] Mutations and Query fields as functions
- [ ] Validate that we don't shadow builtins
- [ ] Figure out how to persist schema with attached directives
  - [ ] https://github.com/graphql/graphql-js/pull/3362

## Future
- [ ] Define resolvers?
- [ ] Generate tasks from playground
- [ ] LSP/VSCode Extension
- [ ] Websites
- [ ] Support positional arguments
- [ ] Support descriptions on enums defined using union types. TS does not support docblock attachements on union types.