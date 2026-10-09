// The playground's service worker. The playground page sends it the editor's
// code and the executable schema Grats generated for it, and it answers
// GraphQL requests to `GRAPHQL_PATH` by executing them against that schema.
//
// Webpack emits it as `/playground-sw.js`. See `plugins/webpack.js`.
import * as GraphQL from "graphql";
import {
  GRAPHQL_PATH,
  type ExecutableModules,
  type ServiceWorkerRequest,
  type ServiceWorkerResponse,
} from "../components/MonacoPlayground/executionProtocol";

// The parts of the service worker API we use. TypeScript's `webworker` lib
// would conflict with the `dom` lib the rest of the site is checked against.
type ExtendableEvent = Event & { waitUntil(promise: Promise<unknown>): void };
type FetchEvent = ExtendableEvent & {
  request: Request;
  clientId: string;
  respondWith(response: Promise<Response>): void;
};
type ExtendableMessageEvent = ExtendableEvent & {
  data: ServiceWorkerRequest;
  source: { id: string } | null;
  ports: readonly MessagePort[];
};
type ServiceWorkerScope = {
  skipWaiting(): Promise<void>;
  clients: {
    claim(): Promise<void>;
    get(id: string): Promise<unknown>;
  };
  addEventListener(
    type: "install" | "activate",
    listener: (event: ExtendableEvent) => void,
  ): void;
  addEventListener(type: "fetch", listener: (event: FetchEvent) => void): void;
  addEventListener(
    type: "message",
    listener: (event: ExtendableMessageEvent) => void,
  ): void;
};

const sw = self as unknown as ServiceWorkerScope;

// Each page (client) has its own schema. The browser stops idle service
// workers, losing their state, so each page's modules are also persisted in a
// cache, keyed by the page's client ID.
const CACHE_NAME = "grats-playground-modules";
const CACHE_KEY_PREFIX = "/playground/__modules/";
const schemas = new Map<string, Promise<GraphQL.GraphQLSchema>>();

// The packages code in the playground can import at runtime. Its imports from
// `grats` are of types, which compile away.
const PACKAGES = new Map<string, unknown>([
  ["graphql", GraphQL],
  ["grats", {}],
]);

sw.addEventListener("install", () => {
  sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(sw.clients.claim());
});

sw.addEventListener("message", (event) => {
  const port = event.ports[0];
  event.waitUntil(
    handleMessage(event.data, event.source?.id).then(
      () => port.postMessage({ ok: true } satisfies ServiceWorkerResponse),
      (e) =>
        port.postMessage({
          ok: false,
          error: errorMessage(e),
        } satisfies ServiceWorkerResponse),
    ),
  );
});

sw.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin || url.pathname !== GRAPHQL_PATH) {
    return;
  }
  event.respondWith(handleGraphQLRequest(event.request, event.clientId));
});

async function handleMessage(
  message: ServiceWorkerRequest,
  clientId: string | undefined,
): Promise<void> {
  switch (message.type) {
    case "claim":
      await sw.clients.claim();
      return;
    case "setModules": {
      if (clientId == null) {
        throw new Error("Expected the message to come from a page.");
      }
      // Evaluate eagerly, so the page learns of errors right away.
      const schema = evaluateSchema(message.modules);
      schemas.set(clientId, Promise.resolve(schema));
      const cache = await caches.open(CACHE_NAME);
      await cache.put(
        CACHE_KEY_PREFIX + encodeURIComponent(clientId),
        new Response(JSON.stringify(message.modules)),
      );
      await pruneClosedClients(cache);
      return;
    }
  }
}

async function handleGraphQLRequest(
  request: Request,
  clientId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ errors: [{ message: "Expected a POST." }] }, 405);
  }
  let body: {
    query?: unknown;
    variables?: Record<string, unknown> | null;
    operationName?: string | null;
  };
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ errors: [{ message: errorMessage(e) }] }, 400);
  }
  if (typeof body.query !== "string") {
    return jsonResponse({ errors: [{ message: "Expected a query." }] }, 400);
  }
  let schema: GraphQL.GraphQLSchema;
  try {
    schema = await getSchema(clientId);
  } catch (e) {
    return jsonResponse({ errors: [{ message: errorMessage(e) }] }, 500);
  }
  const result = await GraphQL.graphql({
    schema,
    source: body.query,
    variableValues: body.variables,
    operationName: body.operationName,
    contextValue: {},
  });
  return jsonResponse(result, 200);
}

function getSchema(clientId: string): Promise<GraphQL.GraphQLSchema> {
  let schema = schemas.get(clientId);
  if (schema == null) {
    schema = loadModules(clientId).then(evaluateSchema);
    schemas.set(clientId, schema);
    // Don't hold on to failures, so a later request can try again.
    schema.catch(() => schemas.delete(clientId));
  }
  return schema;
}

async function loadModules(clientId: string): Promise<ExecutableModules> {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(
    CACHE_KEY_PREFIX + encodeURIComponent(clientId),
  );
  if (response == null) {
    throw new Error("No schema has been loaded for this page.");
  }
  return response.json();
}

// Forget the schemas of pages which have since been closed.
async function pruneClosedClients(cache: Cache): Promise<void> {
  for (const request of await cache.keys()) {
    const { pathname } = new URL(request.url);
    const clientId = decodeURIComponent(
      pathname.slice(CACHE_KEY_PREFIX.length),
    );
    if ((await sw.clients.get(clientId)) == null) {
      schemas.delete(clientId);
      await cache.delete(request);
    }
  }
}

// Runs the modules, CommonJS style, and returns the schema they define.
function evaluateSchema(modules: ExecutableModules): GraphQL.GraphQLSchema {
  const loaded = new Map<keyof ExecutableModules, Record<string, unknown>>();
  function load(name: keyof ExecutableModules): Record<string, unknown> {
    let exports = loaded.get(name);
    if (exports == null) {
      exports = {};
      loaded.set(name, exports);
      const run = new Function("require", "module", "exports", modules[name]);
      run(require, { exports }, exports);
    }
    return exports;
  }
  function require(specifier: string): unknown {
    if (PACKAGES.has(specifier)) {
      return PACKAGES.get(specifier);
    }
    const name = specifier.replace(/^\.\//, "").replace(/\.[jt]s$/, "");
    if (name === "index" || name === "schema") {
      return load(name);
    }
    throw new Error(
      `Cannot find module "${specifier}". Code in the playground can only import "graphql" and "grats".`,
    );
  }
  const { getSchema } = load("schema") as {
    getSchema(config: unknown): GraphQL.GraphQLSchema;
  };
  // Custom scalars get GraphQL.js' default serialization and parsing.
  return getSchema({ scalars: new Proxy({}, { get: () => ({}) }) });
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
