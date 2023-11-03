import { Float } from "grats";
import {
  ItemApiResponse,
  MetadataApiResponse,
  metadataApi,
} from "../ArchiveApi";
import Collection from "./Collection";

/**
 * Archive.org is made up of “items”. An item is a logical “thing” that we
 * represent on one web page on archive.org. An item can be considered as a
 * group of files that deserve their own metadata. If the files in an item have
 * separate metadata, the files should probably be in different items. An item
 * can be a book, a song, an album, a dataset, a movie, an image or set of
 * images, etc. Every item has an identifier that is unique across archive.org.
 *
 * https://archive.org/developers/items.html
 *
 * @gqlType */
export default class Item {
  apiResponse: ItemApiResponse;

  _metadata: Promise<MetadataApiResponse> | null = null;

  constructor(apiResponse: ItemApiResponse) {
    this.apiResponse = apiResponse;
    this._metadata;
  }

  async metadata(): Promise<MetadataApiResponse> {
    if (this._metadata == null) {
      this._metadata = metadataApi(this.identifier());
    }
    return this._metadata;
  }

  /**
   * The Internet Archive's unique identifier for this item.
   * @gqlField */
  identifier(): string {
    return this.apiResponse.identifier;
  }

  /** @gqlField */
  title(): string {
    return this.apiResponse.title;
  }

  /** @gqlField */
  url(): string {
    return "https://archive.org/details/" + this.identifier();
  }

  /**
   * HTML string of the item's description.
   * @gqlField */
  async description(): Promise<string> {
    const metadata = await this.metadata();
    return metadata.metadata.description;
  }

  /** @gqlField */
  async uploader_name(): Promise<string> {
    const metadata = await this.metadata();
    return metadata.metadata.uploader;
  }

  /** @gqlField */
  async creator_name(): Promise<string> {
    const metadata = await this.metadata();
    return metadata.metadata.creator;
  }

  /** @gqlField */
  stars(): Float | null {
    return this.apiResponse.stars;
  }

  /** @gqlField */
  // TODO: Should this be an enum?
  mediaType(): string {
    return this.apiResponse.mediatype;
  }

  /** @gqlField */
  async collections(): Promise<Collection[]> {
    const metadata = await this.metadata();
    let collections = metadata.metadata.collection;
    if (typeof collections === "string") {
      collections = [collections];
    }
    return collections.map((identifier) => {
      return new Collection(identifier);
    });
  }
}

/*
export function getItemByIdentifier(identifier: string): Promise<Item> {
  return metadataApi(identifier).then((metadata) => {
    return new Item({
      identifier: metadata.metadata.identifier,
      title: metadata.metadata.title,
      stars: null,
      mediatype: metadata.metadata.collection,
    });
  });
}
*/
