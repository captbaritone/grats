# Generics TODO

Here are edge cases that we'll want to test for:

- [ ] What are all the different definition types that can have generics?

  - [x] TypeAlias
  - [x] Class
  - [x] Interface
  - [ ] ???

- [ ] A scalar used as a generic (This should result in a diagnostic)
- [ ] A generic on a type/function that is not used as a GQL generic
- [ ] A generic on a type/function that is used as a GQL generic alongside a generic that is
- [ ] Enum value derived from generic
  - [ ] This should error since enums should be scalars
- [ ] Argument as generic value
- [ ] Generic type returned from function field
- [ ] Define a field on a templated type. currently breaks because we can't find the NameDefinition of the synthesized type
- [ ] Revisit docs
- [ ] Revisit @stream docs
- [ ] Validate that \_\_typename validation works on templated types
