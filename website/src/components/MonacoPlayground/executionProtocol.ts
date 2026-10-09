// Shared between the playground page, the Grats worker and the playground's
// service worker (`src/workers/playground.sw.ts`).

/** The path the service worker answers GraphQL requests at. */
export const GRAPHQL_PATH = "/playground/graphql";

/** The scope the service worker is registered with. Covers `GRAPHQL_PATH`. */
export const SERVICE_WORKER_SCOPE = "/playground";

/**
 * The editor's code and the executable schema Grats generated for it, each
 * compiled to a CommonJS module. `schema` imports `index` as `./index`.
 */
export type ExecutableModules = {
  index: string;
  schema: string;
};

export type ExecutableModulesResult =
  | { kind: "OK"; modules: ExecutableModules }
  | { kind: "ERROR"; message: string };

/** Messages the page sends the service worker, over a `MessageChannel`. */
export type ServiceWorkerRequest =
  // Load the schema for requests from the sending page.
  | { type: "setModules"; modules: ExecutableModules }
  // Take control of the sending page, if the service worker doesn't already.
  | { type: "claim" };

export type ServiceWorkerResponse = { ok: true } | { ok: false; error: string };
