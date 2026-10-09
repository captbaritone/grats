import React, { useEffect, useState } from "react";
import { GraphiQL } from "graphiql";
import "graphiql/style.css";
import "./graphiql-theme.css";
import { useColorMode } from "@docusaurus/theme-common";
import { SANDBOX } from "./Sandbox";
import { LoadingFallback } from "./LoadingFallback";
import { MONACO_THEMES } from "./Editor";
import { execute, setModules } from "./executor";
import styles from "./playground.module.css";

type Fetcher = React.ComponentProps<typeof GraphiQL>["fetcher"];

type SchemaState =
  | { kind: "LOADING" }
  | { kind: "READY"; fetcher: Fetcher }
  | { kind: "ERROR"; title: string; details: string };

// GraphiQL persists its tabs and history. Keep them in memory, so they survive
// switching back to the code, but not reloading the page, which may be a
// different playground.
const STORAGE = createMemoryStorage();

// Pointers, rather than an example query, which might not match the code's
// schema. GraphiQL's own default is a long introduction.
const DEFAULT_QUERY = `# Query the schema your code defines.
#
# Ctrl+Space: autocomplete
# Ctrl+Enter: run (⌘+Enter on a Mac)
#
# To explore the schema, open the
# docs from the book in the sidebar.

query {
  __typename # Replace me with fields
}
`;

// How long to wait after the code stops changing before reloading the schema.
const RELOAD_DELAY_MS = 400;

/**
 * GraphiQL, executing against the schema defined by the code in the editor.
 * When it mounts, and once the code or config stops changing, the code and the
 * executable schema Grats generates for it are loaded into the playground's
 * service worker.
 */
export function ExecutePanel() {
  const { colorMode } = useColorMode();
  const [schema, setSchema] = useState<SchemaState>({ kind: "LOADING" });

  useEffect(() => {
    let unmounted = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let loadedModules: string | null = null;
    async function load() {
      try {
        const worker = await SANDBOX.getWorker();
        const modules = await worker.getExecutableModules();
        if (unmounted) return;
        if (modules.kind === "ERROR") {
          loadedModules = null;
          setSchema({
            kind: "ERROR",
            title: "Grats found errors in the server's code",
            details: modules.message,
          });
          return;
        }
        // Most changes, like to an output tab or a comment, don't change
        // what's executed.
        const serialized = JSON.stringify(modules.modules);
        if (serialized === loadedModules) return;
        await setModules(modules.modules);
        if (unmounted) return;
        loadedModules = serialized;
        // A new fetcher makes GraphiQL introspect the new schema.
        const fetcher: Fetcher = (params) =>
          execute(params) as ReturnType<Fetcher>;
        setSchema({ kind: "READY", fetcher });
      } catch (e) {
        if (unmounted) return;
        loadedModules = null;
        setSchema({
          kind: "ERROR",
          title: "The schema couldn't be loaded",
          details: errorMessage(e),
        });
      }
    }
    // Wait for the code to stop changing.
    const disposable = SANDBOX.onTSDidChange(() => {
      clearTimeout(timeout);
      timeout = setTimeout(load, RELOAD_DELAY_MS);
    });
    load();
    return () => {
      unmounted = true;
      clearTimeout(timeout);
      disposable.dispose();
    };
  }, []);

  switch (schema.kind) {
    case "LOADING":
      return <LoadingFallback />;
    case "ERROR":
      return (
        <div className={styles.message}>
          <div className={styles.messageTitle}>{schema.title}</div>
          <div className={styles.messageText}>
            Fix them on the server, then come back to query the schema.
          </div>
          <pre className={styles.messageBody}>{schema.details}</pre>
        </div>
      );
    case "READY":
      return (
        <div className={styles.graphiql}>
          <GraphiQL
            fetcher={schema.fetcher}
            defaultQuery={DEFAULT_QUERY}
            storage={STORAGE}
            forcedTheme={colorMode}
            // Monaco's theme is global, so GraphiQL shares the playground's.
            editorTheme={MONACO_THEMES}
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
