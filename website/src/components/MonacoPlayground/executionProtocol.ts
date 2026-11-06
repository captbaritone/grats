// Shared between the playground page, the Grats worker and the playground's
// executor worker (`src/workers/executor.worker.ts`).

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

export type GraphQLParams = {
  query: string;
  variables?: Record<string, unknown> | null;
  operationName?: string | null;
};

/** Messages the page sends the executor worker, over a `MessageChannel`. */
export type ExecutorRequest =
  // Load the schema subsequent requests are executed against.
  | { type: "setModules"; modules: ExecutableModules }
  // Execute a GraphQL request. Responds with its result, as JSON would have it.
  | { type: "execute"; params: GraphQLParams };

export type ExecutorResponse =
  | { ok: true; result?: unknown }
  | { ok: false; error: string };
