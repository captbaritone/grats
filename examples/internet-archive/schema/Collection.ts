import { Int } from "../../../dist/src";
import { scrapeApi } from "../ArchiveApi";
import ItemsConnection from "./ItemsConnection";

/**
 * Items can be placed in collections. For example, a collection called European
 * Libraries can contain several items, one of which can be Euclid’s Geometry.
 * An item can belong to more than one collection. See [Internet Archive
 * Items](https://archive.org/developers/items.html).
 * @gqlType */
export default class Collection {
  /**
   * Unique identifier for this collection.
   * @gqlField */
  identifier: string;

  constructor(identifier: string) {
    this.identifier = identifier;
  }

  /** @gqlField */
  url(): string {
    return "https://archive.org/details/" + this.identifier;
  }

  /** @gqlField */
  async items({
    first = 100,
  }: {
    /** Max 10,000 */
    first?: Int;
  }): Promise<ItemsConnection> {
    if (first > 10000) {
      throw new Error("The maximum value for `first` is 10,000.");
    }

    let response = await scrapeApi(
      `collection:${this.identifier}`,
      Math.max(first, 100)
    );

    if (first < 100) {
      response = {
        ...response,
        items: response.items.slice(0, first),
      };
    }
    return ItemsConnection.fromScapeApiResponse(response);
  }
}
