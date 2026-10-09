import React, { useEffect, useState } from "react";
import { GraphiQL } from "graphiql";
import "graphiql/style.css";
import { useColorMode } from "@docusaurus/theme-common";
import { SANDBOX } from "./Sandbox";
import { LoadingFallback } from "./LoadingFallback";
import { execute, setModules } from "./executor";

type Fetcher = React.ComponentProps<typeof GraphiQL>["fetcher"];

type SchemaState =
  | { kind: "LOADING" }
  | { kind: "READY"; fetcher: Fetcher }
  | { kind: "ERROR"; message: string };

// Matches the default code in `Sandbox.ts`.
const DEFAULT_QUERY = `query {
  me {
    name
    greeting(salutation: "Hello")
  }
}
`;

// GraphiQL persists its tabs and history. Keep them in memory, so they survive
// switching back to the code, but not reloading the page, which may be a
// different playground.
const STORAGE = createMemoryStorage();

/**
 * GraphiQL, executing against the schema defined by the code in the editor.
 * Each time it's shown, or the config changes, the code and the executable
 * schema Grats generates for it are loaded into the playground's service
 * worker.
 */
export function ExecutePanel() {
  const { colorMode } = useColorMode();
  const [schema, setSchema] = useState<SchemaState>({ kind: "LOADING" });

  useEffect(() => {
    let unmounted = false;
    async function load() {
      try {
        const worker = await SANDBOX.getWorker();
        const modules = await worker.getExecutableModules();
        if (modules.kind === "ERROR") {
          throw new Error(
            `Fix the errors Grats reported in the code:\n\n${modules.message}`,
          );
        }
        await setModules(modules.modules);
        if (unmounted) return;
        // A new fetcher makes GraphiQL introspect the new schema.
        const fetcher: Fetcher = (params) =>
          execute(params) as ReturnType<Fetcher>;
        setSchema({ kind: "READY", fetcher });
      } catch (e) {
        if (unmounted) return;
        setSchema({ kind: "ERROR", message: errorMessage(e) });
      }
    }
    const disposable = SANDBOX.onTSDidChange(load);
    load();
    return () => {
      unmounted = true;
      disposable.dispose();
    };
  }, []);

  switch (schema.kind) {
    case "LOADING":
      return <LoadingFallback />;
    case "ERROR":
      return (
        <pre
          style={{
            height: "100%",
            margin: 0,
            borderRadius: 0,
            color: "var(--ifm-color-danger)",
            whiteSpace: "pre-wrap",
          }}
        >
          {schema.message}
        </pre>
      );
    case "READY":
      return (
        <div style={{ height: "100%" }}>
          <GraphiQL
            fetcher={schema.fetcher}
            defaultQuery={DEFAULT_QUERY}
            storage={STORAGE}
            forcedTheme={colorMode}
          />
        </div>
      );
  }
}

function createMemoryStorage(): React.ComponentProps<
  typeof GraphiQL
>["storage"] & {} {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
    clear: () => items.clear(),
    get length() {
      return items.size;
    },
  };
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
