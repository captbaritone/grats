interface IThing {
  name: string;
}

/**
 * @gqlInterface
 */
export interface IPerson extends IThing {
  /** @gqlField */
  name: string;
}
