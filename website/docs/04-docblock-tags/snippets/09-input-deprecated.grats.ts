// trim-start
import { Int } from "grats";

// trim-end
/** @gqlInput */
type MyInput = {
  name: string;
  /** @deprecated Don't ask for age any more */
  age?: Int;
};
