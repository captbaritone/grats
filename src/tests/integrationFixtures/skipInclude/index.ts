/** @gqlQueryField */
export function greeting(): string {
  return "Hello World!";
}

/** @gqlDirective on FIELD */
export function CustomDirective() {
  //
}

export const query = /* GraphQL */ `
  query {
    greeting @include(if: true)
  }
`;
