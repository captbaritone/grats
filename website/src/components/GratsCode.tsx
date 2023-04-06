import React, { useMemo, useState } from "react";
import CodeBlock from "@theme/CodeBlock";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

type Props = {
  out: string;
  mode: "ts" | "gql" | "both";
};

export default function GratsCode({ out, mode }: Props) {
  const [ts, gql] = useMemo(() => {
    if (typeof out !== "string") {
      throw new Error("Expected out prop to be string");
    }
    const chunks = out.split("=== SNIP ===").map((str) => str.trim());
    if (chunks.length !== 2) {
      throw new Error("Expceted children to be special grats code");
    }
    return chunks;
  });
  const [expanded, setExpanded] = useState(false);
  switch (mode) {
    case "ts":
      return <CodeBlock language="tsx">{ts}</CodeBlock>;
    case "gql":
      return <CodeBlock language="graphql">{gql}</CodeBlock>;
    case "both":
      return (
        <Tabs>
          <TabItem value="typescript" label="TypeScript" default>
            <CodeBlock language="tsx">{ts}</CodeBlock>
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
