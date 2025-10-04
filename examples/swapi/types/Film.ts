import type { Int } from "grats";
import type { Species } from "./Species.js";
import { connectionFromArray } from "../arrayConnection.js";

/**
 * A single film.
 * @gqlType
 */
export type Film = {
  /**
   * The title of the film.
   * @gqlField
   */
  title: string;
  /**
   * The episode number of this film.
   * @gqlField episodeID
   */
  episode_id: Int;
  /**
   * The opening paragraphs at the beginning of this film.
   */
  opening_crawl: string;
  /**
   * The name of the director of this film.
   * @gqlField
   */
  director: string;

  /**
   * Comma-separated names of producers.
   */
  producer: string | undefined;

  /**
   * The ISO 8601 date format of film release at original creator country.
   * @gqlField releaseDate
   */
  release_date: string;

  /** List of URLs */
  species: string[];
};

/**
 * The name(s) of the producer(s) of this film.
 * @gqlField
 */
export function producers(film: Film): string[] | null {
  if (film.producer == null) {
    return null;
  }
  return film.producer.split(",").map((name) => name.trim());
}

/** @gqlField */
export async function speciesConnection(
  film: Film,
  after: string | null | undefined,
  first: Int | null | undefined,
  before: string | null | undefined,
  last: Int | null | undefined,
): Promise<Connection<Film, Species>> {
  const species = await Promise.all(
    film.species.map((url) =>
      fetch(url).then((res) => res.json() as Promise<Species>),
    ),
  );
  return connectionFromArray<Species>(species, {
    after,
    first,
    before,
    last,
  });
}

/** @gqlType <_From><To>Connection */
export class Connection<_From, To> {
  constructor(
    /** @gqlField */
    public edges: Edge<To>[],
    /** @gqlField */
    public pageInfo: PageInfo,
  ) {}

  /** @gqlField <To> */
  nodes(): To[] {
    return this.edges.map((edge) => edge.node);
  }
}

/**
 * Information about pagination in a connection.
 * @gqlType
 */
export type PageInfo = {
  /**
   * When paginating forwards, are there more items?
   * @gqlField
   * @killsParentOnException
   */
  hasNextPage: boolean;

  /**
   * When paginating backwards, are there more items?
   * @gqlField
   * @killsParentOnException
   */
  hasPreviousPage: boolean;

  /**
   * When paginating backwards, the cursor to continue.
   * @gqlField
   */
  startCursor: string | null;

  /**
   * When paginating forwards, the cursor to continue.
   * @gqlField
   */
  endCursor: string | null;
};

/** @gqlType */
export type Edge<T> = {
  /** @gqlField */
  node: T;
  /**
   * @gqlField
   * @killsParentOnException
   */
  cursor: string;
};
