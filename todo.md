# Generics TODO

Here are edge cases that we'll want to test for:

- [ ] A generic on a class (all declaration types that can have generics)
- [ ] A scalar used as a generic
- [ ] A generic on a type/function that is not used as a GQL generic
- [ ] A generic on a type/function that is used as a GQL generic alongside a generic that is
- [ ] Enum value derived from generic
- [ ] Argument as generic value
- [ ] Generic type returned from function field
- [ ] Define a field on a templated type. currently breaks because we can't find the NameDefinition of the synthesized type
