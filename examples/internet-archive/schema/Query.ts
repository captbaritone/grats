import { Int } from "grats";
import { scrapeApi } from "../ArchiveApi";
import ItemsConnection from "./ItemsConnection";

// TODO: Ideally this comment would be added to the schema, not the query.
/**
 * This API is a GraphQL facade on top of the Internet Archive's existing REST API.
 *
 * Its goal is to improve the developer experience of using the Internet Archive's
 * API by:
 *
 * - Providing a single endpoint for all queries.
 * - Providing a well defined schema that can be used to explore the API and reason about the data it returns.
 *
 * In the future it might also:
 *
 * - Provide an abstraction that can be used client-side in the browser or server-side in Node.js.
 * - Provide a more efficient way to fetch data by leveraging query planing to batch requests or make other optimizations.
 * - Provide a proof of concept to motivate the Internet Archive to build a GraphQL API.
 * @gqlType */
export class Query {} // TODO: Allow grats to support (and enforce!) Query be type undefined.

/**
 * Search the Internet Archive for books, movies, and more.
 *

 * @gqlField */
export async function searchItems(
  _: Query,
  {
    query,
    first = 100,
  }: {
    query: string;
    /** Max 10,000 */
    first?: Int;
  }
): Promise<ItemsConnection> {
  if (first > 10000) {
    throw new Error("The maximum value for `first` is 10,000.");
  }

  let response = await scrapeApi(query, Math.max(first, 100));

  if (first < 100) {
    response = {
      ...response,
      items: response.items.slice(0, first),
    };
  }
  const itemsConnection = ItemsConnection.fromScapeApiResponse(response);

  console.log({ itemsConnection });

  return itemsConnection;
}
