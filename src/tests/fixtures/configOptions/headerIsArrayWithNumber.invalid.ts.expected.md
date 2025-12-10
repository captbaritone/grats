-----------------
INPUT
----------------- 
// {"schemaHeader": ["Hello", 1]}
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: string;
}

-----------------
OUTPUT
-----------------
error: Expected property `schemaHeader` to be a string or array of strings, but got ["Hello",1].
