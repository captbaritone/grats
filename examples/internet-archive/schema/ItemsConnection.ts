import { ScapeApiResponse } from "../ArchiveApi";
import Item from "./Item";

/**
 * A connection modeling a list of items.
 *
 * In the future this could be extended to support cursor-based pagination.
 * @gqlType */
export default class ItemsConnection {
  static fromScapeApiResponse(json: ScapeApiResponse): ItemsConnection {
    const edges = json.items.map((item) => {
      const node = new Item(item);
      return new ItemsEdge(node);
    });
    return new ItemsConnection(edges);
  }

  constructor(edges: ItemsEdge[]) {
    this.edges = edges;
  }

  /**
   * A list of edges.
   * @gqlField */
  edges: ItemsEdge[];

  /**
   * Convenience field for getting the nodes of the edges.
   * @gqlField */
  nodes(): Item[] {
    return this.edges.map((edge) => edge.node);
  }
}

/** @gqlType */
class ItemsEdge {
  constructor(item: Item) {
    this.node = item;
  }

  /** @gqlField */
  node: Item;
}
