/** @gqlEnum */
type First = (typeof MUTABLE)[number];

let MUTABLE = ["A", "B"] as const;

/** @gqlEnum */
type Mutable = (typeof MUTABLE)[number];

const FIRST = ["A", "B"] as const,
  SECOND = ["C"] as const;

/** @gqlEnum */
type Multiple = (typeof FIRST)[number];

const [DESTRUCTURED] = [["A", "B"] as const];

/** @gqlEnum */
type Destructured = (typeof DESTRUCTURED)[number];

const OTHER_NAME = ["A", "B"] as const;

/** @gqlEnum */
type Mismatch = (typeof NAME)[number];
