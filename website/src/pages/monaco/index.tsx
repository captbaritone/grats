import React from "react";
import Layout from "@theme/Layout";
import MonacoPlayground from "@site/src/components/MonacoPlayground/MonacoPlayground";
const BrowserOnly = require("@docusaurus/BrowserOnly").default;

function Editor(props) {
  return (
    <Layout title={`Playground`} noFooter>
      <BrowserOnly fallback={<div>Loading Monaco Editor...</div>}>
        {() => <MonacoPlayground />}
      </BrowserOnly>
    </Layout>
  );
}

export default Editor;
