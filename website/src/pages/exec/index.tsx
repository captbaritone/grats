import {
  createDefaultMapFromCDN,
  createSystem,
  createVirtualCompilerHost,
} from "@typescript/vfs";
import * as ts from "typescript";
import lzstring from "lz-string";
import GRATS_TYPE_DECLARATIONS from "!!raw-loader!grats/src/Types.ts";

import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";
import { buildSchemaAndDocResultWithHost, GratsConfig } from "grats/src/lib";
import { codegen } from "grats/src/codegen/schemaCodegen";
import { useState } from "react";

if (ExecutionEnvironment.canUseDOM) {
  // @ts-ignore
  window.process = {
    // Grats depends upon calling path.resolver and path.relative
    // which depend upon process.cwd() being set.
    // Here we supply a fake cwd() function that returns the root
    cwd() {
      return "/";
    },
  };
}

export default function () {
  const [gratsCode, setGratsCode] = useState(`/** @gqlQueryField */
export function me(): User {
  return new User();
}

/** @gqlType */
class User {
  /** @gqlField */
  greet(): string {
    return \`Hello Jordan\`;
  }
}`);

  const [query, setQuery] = useState(`query {
  me {
    greet
  }
}`);

  const [result, setResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      const result = await exec(gratsCode, query);
      setResult(JSON.stringify(result, null, 2));
    } catch (error) {
      setResult(JSON.stringify({ error: error.message }, null, 2));
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        padding: "32px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          backgroundColor: "white",
          borderRadius: "16px",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          padding: "32px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "40px",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              flex: "2",
              display: "flex",
              flexDirection: "column",
              gap: "32px",
            }}
          >
            <div>
              <h2
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#1f2937",
                }}
              >
                Grats Schema
              </h2>
              <textarea
                style={{
                  width: "100%",
                  height: "280px",
                  padding: "16px",
                  border: "2px solid #e5e7eb",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Monaco, Consolas, monospace",
                  resize: "vertical",
                  outline: "none",
                  transition: "border-color 0.2s ease",
                  lineHeight: "1.5",
                }}
                value={gratsCode}
                onChange={(e) => setGratsCode(e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                placeholder="Enter your Grats schema code here..."
              />
            </div>
            <div>
              <h2
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#1f2937",
                }}
              >
                GraphQL Query
              </h2>
              <textarea
                style={{
                  width: "100%",
                  height: "280px",
                  padding: "16px",
                  border: "2px solid #e5e7eb",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Monaco, Consolas, monospace",
                  resize: "vertical",
                  outline: "none",
                  transition: "border-color 0.2s ease",
                  lineHeight: "1.5",
                }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                placeholder="Enter your GraphQL query here..."
              />
            </div>
          </div>

          <div
            style={{
              flex: "1",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              minWidth: "400px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              <h2
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#1f2937",
                }}
              >
                Result
              </h2>

              <button
                onClick={handleExecute}
                disabled={isExecuting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  width: "100%",
                  padding: "16px 24px",
                  backgroundColor: isExecuting ? "#9ca3af" : "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: isExecuting ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: isExecuting
                    ? "none"
                    : "0 2px 4px rgba(16, 185, 129, 0.2)",
                  minHeight: "56px",
                }}
              >
                <span
                  style={{
                    fontSize: "20px",
                    display: "flex",
                    alignItems: "center",
                    transform: isExecuting ? "none" : "translateX(1px)",
                  }}
                >
                  {isExecuting ? "⏳" : "▶️"}
                </span>
                <span>{isExecuting ? "Executing..." : "Run Query"}</span>
              </button>

              <textarea
                style={{
                  width: "100%",
                  height: "480px",
                  padding: "16px",
                  border: "2px solid #e5e7eb",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Monaco, Consolas, monospace",
                  backgroundColor: "#f9fafb",
                  color: "#374151",
                  resize: "vertical",
                  outline: "none",
                  lineHeight: "1.5",
                }}
                value={result || "// Results will appear here after execution"}
                readOnly
                placeholder="Results will appear here..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const GRATS_PATH = "/node_modules/grats/src/index.ts";

const shouldCache = false;

async function exec(gratsCode: string, queryText: string): Promise<any> {
  const fsMap = await createDefaultMapFromCDN(
    { target: ts.ScriptTarget.ES2021, lib: ["es2021"] },
    // We have upgraded to
    "5.5.4", //ts.version,
    shouldCache,
    ts,
    lzstring,
  );
  // There's some bug/mismatch where the files that are expected by our version of
  // TypeScript don't exactly match those included in/accessible by the
  // `@typescript/vfs` package. If it's missing a file it crashes, so we'll
  // include them as empty for now. Their actual contents are just a few very
  // obscure APIs, so it's probably fine to just leave them for now.
  for (const fileName of [
    "/lib.es2016.intl.d.ts",
    "/lib.dom.asynciterable.d.ts",
  ]) {
    fsMap.set(fileName, "");
  }

  fsMap.set("index.ts", gratsCode);
  fsMap.set(GRATS_PATH, GRATS_TYPE_DECLARATIONS);
  fsMap.set(
    "/node_modules/graphql/index.ts",
    `
    export type GraphQLResolveInfo = any;
    export type GraphQLScalarLiteralParser<T> = any;
    export type GraphQLScalarSerializer<T> = any;
    export type GraphQLScalarValueParser<T> = any;
    `,
  );

  const system = createSystem(fsMap);

  const compilerOpts = {
    allowJs: true,
    baseUrl: "./",
    paths: { grats: [GRATS_PATH] },
    lib: [...fsMap.keys()],
    module: ts.ModuleKind.ESNext, // <— force ES modules
    target: ts.ScriptTarget.ES2020,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    // module: ts.ModuleKind.ES2020,
    // target: ts.ScriptTarget.ES2020,
    // noEmitOnError: false,
  };
  const host = createVirtualCompilerHost(system, compilerOpts, ts);

  const config: GratsConfig = {
    graphqlSchema: "schema.graphql",
    tsSchema: "schema.ts",
    nullableByDefault: true,
    strictSemanticNullability: false,
    reportTypeScriptTypeErrors: true,
    schemaHeader: null,
    tsSchemaHeader: null,
    importModuleSpecifierEnding: ".js",
    EXPERIMENTAL__emitMetadata: false,
    EXPERIMENTAL__emitResolverMap: false,
  };

  const parsedOptions = {
    raw: {
      grats: config,
    },

    options: compilerOpts,
    fileNames: ["index.ts"],
    errors: [],
  };

  // const program = ts.createProgram(
  //   parsedOptions.fileNames,
  //   parsedOptions.options,
  //   host.compilerHost,
  // );

  const schemaAndDoc = buildSchemaAndDocResultWithHost(
    parsedOptions,
    host.compilerHost,
  );

  if (schemaAndDoc.kind === "ERROR") {
    console.error(schemaAndDoc.err);
    return;
  }

  const result = schemaAndDoc;

  const codegenOutput = codegen(
    result.value.schema,
    result.value.resolvers,
    config,
    "./schema.ts",
  );

  fsMap.set("schema.ts", codegenOutput);

  const programComplete = ts.createProgram(
    ["index.ts", "schema.ts"],
    parsedOptions.options,
    host.compilerHost,
  );
  const { diagnostics } = programComplete.emit();

  const index = fsMap.get("index.js");

  const schema = fsMap.get("schema.js");
  const rewrites = [
    {
      name: "graphql",
      url: "https://cdn.jsdelivr.net/npm/graphql@16.11.0/index.mjs",
    },
    {
      name: "./index.js",
      url: encode(index!),
    },
  ];

  let rewrote = schema;
  for (const { name, url } of rewrites) {
    rewrote = importRewriter(rewrote!, name, url);
  }

  const schemaUrl = encode(rewrote!);
  return execQuery(schemaUrl, queryText);
}

function importRewriter(source: string, name: string, url: string): string {
  return source.replace(new RegExp(`"${name}"`, "g"), `"${url}"`);
}

function encode(text: string): string {
  const workerBlob = new Blob([text], { type: "application/javascript" });
  const workerUrl = URL.createObjectURL(workerBlob);
  return workerUrl;
}

async function execQuery(schemaUrl: string, query: string): Promise<any> {
  // Create worker code as a string to sandbox it
  const workerCode = `
        // Import GraphQL from CDN (no access to domain resources)
        import { graphql, buildSchema } from 'https://cdn.jsdelivr.net/npm/graphql@16.11.0/index.mjs';
        import {getSchema} from '${schemaUrl}';

        // Define a simple GraphQL schema
        const schema = getSchema();


        // Listen for messages from the main thread
        self.addEventListener('message', async (event) => {
            const { type, query, id } = event.data;
            
            if (type === 'EXECUTE_QUERY') {
                try {
                    const result = await graphql({
                        schema: schema,
                        source: query,
                    });
                    
                    // Send the result back to the main thread
                    self.postMessage({
                        type: 'QUERY_RESULT',
                        id: id,
                        result: result
                    });
                } catch (error) {
                    // Send the error back to the main thread
                    self.postMessage({
                        type: 'QUERY_ERROR',
                        id: id,
                        error: error.message
                    });
                }
            }
        });

        // Send a ready message to indicate the worker is initialized
        self.postMessage({
            type: 'WORKER_READY'
        });
        `;

  // Create a sandboxed worker using a data URL (no domain access)
  const workerUrl = encode(workerCode);
  const worker = new Worker(workerUrl, {
    type: "module",
    credentials: "omit", // Prevent sending credentials
  });

  // Clean up the blob URL after creating the worker
  URL.revokeObjectURL(workerUrl);

  let queryIdCounter = 0;
  const pendingQueries = new Map();

  let resolveWorkerReady;
  const workerReady = new Promise((resolve) => {
    resolveWorkerReady = resolve;
  });

  // Handle messages from the worker
  worker.addEventListener("message", (event) => {
    const { type, id, result, error } = event.data;
    console.log(event.data);

    if (type === "WORKER_READY") {
      // Execute the query once the worker is ready
      resolveWorkerReady();
    } else if (type === "QUERY_RESULT") {
      const { resolve } = pendingQueries.get(id);
      pendingQueries.delete(id);
      console.log("Got result:", result, " for id:", id);
      resolve(result);
    } else if (type === "QUERY_ERROR") {
      const { reject } = pendingQueries.get(id);
      pendingQueries.delete(id);
      reject(new Error(error));
    }
  });

  // Function to execute GraphQL query in the worker
  function executeGraphQLQuery(query) {
    return new Promise((resolve, reject) => {
      const id = ++queryIdCounter;
      console.log("Executing query with id:", id);
      pendingQueries.set(id, { resolve, reject });

      worker.postMessage({
        type: "EXECUTE_QUERY",
        query: query,
        id: id,
      });
    });
  }

  // Execute the query
  await workerReady;
  return await executeGraphQLQuery(query);
}
