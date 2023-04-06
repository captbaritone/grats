/** @gqlType */
export class User {
  name: string;

  // highlight-start
  /** @gqlField greeting */
  // highlight-end
  getGreeting(): string {
    return `Hello, ${this.name}`;
  }
}
