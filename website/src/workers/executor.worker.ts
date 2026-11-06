// The playground's executor worker. The playground page sends it the editor's
// code and the executable schema Grats generated for it, and then GraphQL
// requests, which it executes against that schema.
import * as GraphQL from "graphql";
import type {
  ExecutableModules,
  ExecutorRequest,
  ExecutorResponse,
} from "../components/MonacoPlayground/executionProtocol";

let schema: GraphQL.GraphQLSchema | null = null;

// The packages code in the playground can import at runtime. Its imports from
// `grats` are of types, which compile away.
const PACKAGES = new Map<string, unknown>([
  ["graphql", GraphQL],
  ["grats", {}],
]);

self.addEventListener("message", (event: MessageEvent<ExecutorRequest>) => {
  const port = event.ports[0];
  handleMessage(event.data).then(
    (result) =>
      port.postMessage({ ok: true, result } satisfies ExecutorResponse),
    (e) =>
      port.postMessage({
        ok: false,
        error: errorMessage(e),
      } satisfies ExecutorResponse),
  );
});

async function handleMessage(message: ExecutorRequest): Promise<unknown> {
  switch (message.type) {
    case "setModules":
      schema = evaluateSchema(message.modules);
      return;
    case "execute": {
      if (schema == null) {
        throw new Error("No schema has been loaded.");
      }
      const { query, variables, operationName } = message.params;
      const result = await GraphQL.graphql({
        schema,
        source: query,
        variableValues: variables,
        operationName,
        contextValue: {},
      });
      // Errors, and values like class instances, don't survive being posted
      // as they are. GraphiQL expects what a server would have sent anyway.
      return JSON.parse(JSON.stringify(result));
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

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
