import React, { useMemo, useState } from "react";
import CodeBlock from "@theme/CodeBlock";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import { serializeState } from "./PlaygroundFeatures/urlState";
import { URL_VERSION } from "./PlaygroundFeatures/defaultState";
import Link from "@docusaurus/Link";
import { parseLines, useThemeConfig } from "@docusaurus/theme-common/internal";

type Props = {
  out: string;
  mode: "ts" | "gql" | "codegen" | "both";
};

export default function GratsCode({ out, mode }: Props) {
  const [ts, gql, codegen] = useMemo(() => {
    if (typeof out !== "string") {
      throw new Error("Expected out prop to be string");
    }
    const chunks = out.split("=== SNIP ===").map((str) => str.trim());
    if (chunks.length !== 3) {
      throw new Error("Expected children to be special grats code");
    }
    return chunks;
  });

  switch (mode) {
    case "ts":
      return (
        <div style={{ position: "relative" }}>
          <CodeBlock language="tsx">{ts}</CodeBlock>
          <PlaygroundLink ts={ts} />
        </div>
      );
    case "gql":
      return <CodeBlock language="graphql">{gql}</CodeBlock>;
    case "codegen":
      return <CodeBlock language="tsx">{codegen}</CodeBlock>;
    case "both":
      return (
        <Tabs>
          <TabItem value="typescript" label="TypeScript" default>
            <div style={{ position: "relative" }}>
              <CodeBlock language="tsx">{ts}</CodeBlock>
              <PlaygroundLink ts={ts} />
            </div>
          </TabItem>
          <TabItem value="graphql" label="GraphQL" default>
            <CodeBlock language="graphql">{gql}</CodeBlock>
          </TabItem>
        </Tabs>
      );
    default:
      throw new Error(`Unexpected GratsCode mode "${mode}".`);
  }
}

function PlaygroundLink({ ts }) {
  const {
    prism: { magicComments },
  } = useThemeConfig();
  const playgroundLink = useMemo(() => {
    const { code: doc } = parseLines(ts, {
      language: "typescript",
      metastring: null,
      magicComments,
    });
    const hash = serializeState({
      doc,
      config: {
        nullableByDefault: true,
        reportTypeScriptTypeErrors: true,
      },
      view: {
        showGratsDirectives: false,
      },
      VERSION: URL_VERSION,
    });
    return `/playground/#${hash}`;
  }, [ts]);

  return (
    <Link
      to={playgroundLink}
      style={{
        position: "absolute",
        color: "var(--ifm-color-primary-lightest)",
        bottom: 16,
        right: 16,
        fontSize: "0.8rem",
      }}
    >
      Playground
    </Link>
  );
}
