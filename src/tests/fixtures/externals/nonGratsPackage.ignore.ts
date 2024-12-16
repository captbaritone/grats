export type SomeType = {
  __typename: "MyType";
  id: string;
};

export type SomeOtherType = {
  __typename: "MyOtherType";
  id: string;
};

export type SomeInterface = {
  id: string;
};

export type SomeInputType = {
  foo: number;
  id: string;
};

export type SomeUnion = SomeType | SomeOtherType;

export type SomeEnum = "A" | "B";

export type SomeScalar = string;
