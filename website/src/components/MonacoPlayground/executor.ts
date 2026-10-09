// Executes GraphQL against the playground's schema, all within the browser:
// the playground's service worker (`src/workers/playground.sw.ts`) answers
// requests to `GRAPHQL_PATH` without them ever reaching the network.
import {
  GRAPHQL_PATH,
  SERVICE_WORKER_SCOPE,
  type ExecutableModules,
  type ServiceWorkerRequest,
  type ServiceWorkerResponse,
} from "./executionProtocol";

export type GraphQLParams = {
  query: string;
  variables?: Record<string, unknown> | null;
  operationName?: string | null;
};

let worker: Promise<ServiceWorker> | null = null;

/**
 * Registers the service worker, once, and resolves once it's active and
 * controls this page.
 */
function getServiceWorker(): Promise<ServiceWorker> {
  if (worker == null) {
    worker = registerServiceWorker();
    // Let a later call try again.
    worker.catch(() => {
      worker = null;
    });
  }
  return worker;
}

async function registerServiceWorker(): Promise<ServiceWorker> {
  if (!("serviceWorker" in navigator)) {
    throw new Error(
      "Executing queries requires service workers, which this browser doesn't support (or has disabled, as some do in private browsing).",
    );
  }
  const registration = await navigator.serviceWorker.register(
    new URL(
      /* webpackChunkName: "playground-sw" */ "../../workers/playground.sw.ts",
      import.meta.url,
    ),
    { scope: SERVICE_WORKER_SCOPE },
  );
  const active = await activeWorker(registration);
  // A page loaded before the service worker was installed, or with a hard
  // reload, isn't controlled by it, and so its requests would bypass it.
  if (navigator.serviceWorker.controller == null) {
    const controlled = new Promise((resolve) =>
      navigator.serviceWorker.addEventListener("controllerchange", resolve, {
        once: true,
      }),
    );
    await request(active, { type: "claim" });
    await controlled;
  }
  return active;
}

function activeWorker(
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorker> {
  if (registration.active != null) {
    return Promise.resolve(registration.active);
  }
  const installing = (registration.installing ?? registration.waiting)!;
  return new Promise((resolve, reject) => {
    installing.addEventListener("statechange", () => {
      if (installing.state === "activated") {
        resolve(installing);
      } else if (installing.state === "redundant") {
        reject(new Error("Failed to install the playground's service worker."));
      }
    });
  });
}

function request(
  worker: ServiceWorker,
  message: ServiceWorkerRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event: MessageEvent<ServiceWorkerResponse>) => {
      if (event.data.ok) {
        resolve();
      } else {
        reject(new Error(event.data.error));
      }
    };
    worker.postMessage(message, [channel.port2]);
  });
}

/**
 * Loads the schema subsequent requests from this page are executed against.
 * Rejects if evaluating the code throws.
 */
export async function setModules(modules: ExecutableModules): Promise<void> {
  await request(await getServiceWorker(), { type: "setModules", modules });
}

/** Executes a GraphQL request against the schema loaded by `setModules`. */
export async function execute(params: GraphQLParams): Promise<unknown> {
  await getServiceWorker();
  const response = await fetch(GRAPHQL_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return response.json();
}
