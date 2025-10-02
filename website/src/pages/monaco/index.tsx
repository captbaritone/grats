import React from "react";
import Layout from "@theme/Layout";
import BrowserOnly from "@docusaurus/BrowserOnly";
import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";
import { LoadingFallback } from "@site/src/components/MonacoPlayground/LoadingFallback";

const MonacoPlayground =
  ExecutionEnvironment.canUseDOM &&
  require("@site/src/components/MonacoPlayground/MonacoPlayground").default;

function Fallback() {
  return (
    <div style={{ minHeight: 500, display: "flex", alignItems: "center" }}>
      <LoadingFallback />
    </div>
  );
}

export default function Page() {
  return (
    <Layout title={`Playground`} noFooter>
      <BrowserOnly fallback={<Fallback />}>
        {() => <MonacoPlayground />}
      </BrowserOnly>
    </Layout>
  );
}
