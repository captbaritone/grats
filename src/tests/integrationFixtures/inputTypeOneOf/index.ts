import { ID } from "../../..";

/** @gqlInput */
type UserPayload = {
  id: ID;
  name: string;
};

/**
 * @gqlInput
 * @oneOf
 */
type Greeting = { name: string } | { userId: ID } | { user: UserPayload };

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greet(_: Query, args: { greeting: Greeting }): string {
  const greeting = args.greeting;
  switch (true) {
    case "name" in greeting:
      return `Hello, ${greeting.name}!`;
    case "userId" in greeting:
      return `Hello, user with ID ${greeting.userId}!`;
    case "user" in greeting:
      return `Hello, ${greeting.user.name} with ID ${greeting.user.id}!`;
    default:
      // Assert exhaustive
      const _exhaustiveCheck: never = greeting;
      throw new Error(`Unexpected greeting: ${JSON.stringify(args.greeting)}`);
  }
}

export const query = `
    query {
      greet(greeting: { name: "Alice" })
    }
  `;
