# Todo for positional args

- [ ] Double check semantics of defaults in TS WRT nullability
- [ ] Can we support destructuring info and context?
  - [ ] Need to wait to report arg name errors until we can resolve the type
  - [ ] Can we store a Result for the name and then only unpack it if/when we need it?
- [ ] What happens if you use an arg object in a different position?
- [ ] What happens if the user tries to use GraphQL-js's info arg?
- [ ] Use interface for `Info` type to allow merging for custom use cases?
- [ ] Update docs to explain new features
  - [ ] Context
  - [ ] Info (new doc needed?)
- [ ] Review examples to see where this feature should/could be used
- [ ] Type check positional info arg in old style
- [ ] Audit error messages to ensure they don't claim args must be objects
- [ ] Validate that we don't have multiple @gqlInfo tags
- [ ] Validate Info references
