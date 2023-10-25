/** @gqlType */
class CustomQuery {
  constructor(greeting: string) {
    this.greeting = greeting;
  }
  /** @gqlField */
  greeting: string;
}

/** @gqlType */
class CustomMutation {
  /** @gqlField */
  updateGreeting(): string {
    return "Hello world!";
  }
}

/** @gqlOperationType */
export function query(): CustomQuery {
  return new CustomQuery("Hello world!");
}

/** @gqlOperationType */
export function mutation(): CustomMutation {
  return new CustomMutation();
}
