// Note: These match the fields requested in the scrape API.
export type ItemApiResponse = {
  identifier: string;
  title: string;
  mediatype: string;
  stars: number;
};

const ITEM_FIELDS = ["identifier", "title", "mediatype", "stars"].join(",");

export type ScapeApiResponse = {
  items: ItemApiResponse[];
};

// https://archive.org/services/swagger/?url=%2Fservices%2Fsearch%2Fbeta%2Fswagger.yaml#!/search/get_scrape_php
export async function scrapeApi(
  query: string,
  count: number
): Promise<ScapeApiResponse> {
  if (count > 10000) {
    throw new Error("The maximum value for `count` is 10,000");
  }
  if (count < 100) {
    throw new Error("The minimum value for `count` is 100");
  }
  // We use the scrape API because it supports cursor-based pagination.
  const searchUrl = new URL("https://archive.org/services/search/v1/scrape");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("count", count.toString());
  searchUrl.searchParams.set("fields", ITEM_FIELDS);
  // TODO: If only `count` is being read, we could use the `totals_only` param as an optimization.
  const response = await fetch(searchUrl);
  if (!response.ok) {
    throw new Error(`Failed to search for ${query}: ${response.statusText}`);
  }

  return response.json();
}

type MetadataApiFileResponse = {
  name: string;
  source: "original" | "derivative";
  format: string;
  md5: string;
  size?: string;
  mtime?: string;
  crc32?: string;
  sha1?: string;

  // Lots of these almost seem free-form
  /*
  rotation?: string;
  original?: string;
  pdf_module_version?: string;
  ocr_module_version?: string;
  ocr_converted?: string;
  */
};

export type MetadataApiResponse = {
  files: MetadataApiFileResponse[];
  files_count: number;
  item_last_updated: number;
  item_size: number;
  metadata: {
    title: string;
    creator: string;
    uploader: string;
    subject: string[];
    description: string;
    date: string;
    collection: string[] | string;
  };
};

// https://blog.archive.org/2013/07/04/metadata-api/
export async function metadataApi(
  identifier: string
): Promise<MetadataApiResponse> {
  // FIXME: Is there a safer way to do this that prevents injection attacks?
  const url = new URL(`http://archive.org/metadata/${identifier}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to search for ${url}: ${response.statusText}`);
  }

  return response.json();
}
