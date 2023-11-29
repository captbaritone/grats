import { Int } from "../../Types";

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function firstHundredIntegers(
  _: Query,
  args: {
    first: Int | null;
    after: string | null;
  },
): FirstHundredIntegersConnection {
  return new FirstHundredIntegersConnection(args.first, args.after);
}

type Connection<T> = {
  pageInfo: PageInfo<T>;
  edges: Edge<T>[];
};

type PageInfo<T> = {
  hasNext: boolean;
  hasPrevious: boolean;
  startCursor: string;
  endCursor: string;
};

type Edge<T> = {
  cursor: string;
  node: T;
};

/** @gqlType */
class FirstHundredIntegersConnection {
  _max: number = 100;

  /** @gqlField */
  pageInfo: FirstHundredIntegersPageInfo;

  /** @gqlField */
  edges: FirstHundredIntegersEdge[];

  constructor(public first: number | null, public after: string | null) {
    const start = parseInt(after || "0", 10);
    const end = first ? start + first : this._max;

    this.edges = [];
    for (let i = start; i < end; i++) {
      this.edges.push(new FirstHundredIntegersEdge(i));
    }

    // TODO: What about empty connections
    this.pageInfo = new FirstHundredIntegersPageInfo({
      hasNext: end < this._max,
      hasPrevious: start > 0,
      startCursor: this.edges[0].cursor,
      endCursor: this.edges[this.edges.length - 1].cursor,
    });
  }
}

/** @gqlType */
class FirstHundredIntegersPageInfo {
  constructor({
    hasNext,
    hasPrevious,
    startCursor,
    endCursor,
  }: {
    hasNext: boolean;
    hasPrevious: boolean;
    startCursor: string;
    endCursor: string;
  }) {
    this.hasNextPage = hasNext;
    this.hasPreviousPage = hasPrevious;
    this.startCursor = startCursor;
    this.endCursor = endCursor;
  }
  /**
   * @gqlField
   * @killsParentOnException
   */
  hasNextPage: boolean;
  /**
   * @gqlField
   * @killsParentOnException
   */
  hasPreviousPage: boolean;

  /** @gqlField */
  startCursor: string;

  /** @gqlField */
  endCursor: string;
}

/** @gqlType */
class FirstHundredIntegersEdge {
  constructor(node: number) {
    this.node = node;
    this.cursor = node.toString();
  }

  /** @gqlField */
  node: Int;

  /** @gqlField */
  cursor: string;
}

function gql(strings: TemplateStringsArray) {
  return strings[0];
}

export const query = gql`
  query {
    firstTwo: firstHundredIntegers(first: 2) {
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        cursor
        node
      }
    }
    secondTwo: firstHundredIntegers(first: 2, after: "2") {
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        cursor
        node
      }
    }
    lastTwo: firstHundredIntegers(first: 2, after: "98") {
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        cursor
        node
      }
    }
  }
`;
