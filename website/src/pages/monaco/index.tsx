import React from "react";
import Layout from "@theme/Layout";
import BrowserOnly from "@docusaurus/BrowserOnly";
import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";
import { LoadingFallback } from "@site/src/components/MonacoPlayground/LoadingFallback";

const MonacoPlayground =
  ExecutionEnvironment.canUseDOM &&
  require("@site/src/components/MonacoPlayground/MonacoPlayground").default;

export default function Page() {
  return (
    <Layout title={`Playground`} noFooter>
      <BrowserOnly fallback={<LoadingFallback />}>
        {() => <MonacoPlayground />}
      </BrowserOnly>
    </Layout>
  );
}
