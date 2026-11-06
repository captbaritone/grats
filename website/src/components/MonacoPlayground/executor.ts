// Executes GraphQL against the playground's schema, all within the browser, in
// the playground's executor worker (`src/workers/executor.worker.ts`).
import type {
  ExecutableModules,
  ExecutorRequest,
  ExecutorResponse,
  GraphQLParams,
} from "./executionProtocol";

let worker: Worker | null = null;

// Rejects each request still awaiting a response.
const pending = new Set<(error: Error) => void>();

/** Starts the executor worker, once. */
function getWorker(): Worker {
  if (worker == null) {
    unregisterServiceWorker();
    worker = new Worker(
      new URL("../../workers/executor.worker.ts", import.meta.url),
    );
    // The worker answers every request, unless it fails to load, or code in
    // the playground throws outside of a request.
    worker.addEventListener("error", (event) => {
      const error = new Error(
        event.message || "The playground's executor worker failed.",
      );
      for (const reject of pending) {
        reject(error);
      }
      pending.clear();
    });
  }
  return worker;
}

// The playground used to execute in a service worker, at `/playground-sw.js`,
// which browsers keep until it's unregistered.
function unregisterServiceWorker(): void {
  navigator.serviceWorker
    ?.getRegistration("/playground")
    .then((registration) => {
      if (registration?.active?.scriptURL.endsWith("/playground-sw.js")) {
        return registration.unregister();
      }
    })
    .catch(() => {});
}

function request(message: ExecutorRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    pending.add(reject);
    channel.port1.onmessage = (event: MessageEvent<ExecutorResponse>) => {
      pending.delete(reject);
      if (event.data.ok) {
        resolve(event.data.result);
      } else {
        reject(new Error(event.data.error));
      }
    };
    getWorker().postMessage(message, [channel.port2]);
  });
}

/**
 * Loads the schema subsequent requests are executed against. Rejects if
 * evaluating the code throws.
 */
export async function setModules(modules: ExecutableModules): Promise<void> {
  await request({ type: "setModules", modules });
}

/** Executes a GraphQL request against the schema loaded by `setModules`. */
export function execute(params: GraphQLParams): Promise<unknown> {
  return request({ type: "execute", params });
}
