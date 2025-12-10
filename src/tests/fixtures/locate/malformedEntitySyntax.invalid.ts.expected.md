-----------------
INPUT
----------------- 
// Locate: User->name
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

-----------------
OUTPUT
-----------------
Invalid entity name: `User->name`. Expected `ParentType` or `ParentType.fieldName`.