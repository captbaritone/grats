import Layout from "@theme/Layout";
import React from "react";
import ConfigBar from "../../../components/PlaygroundFeatures/ConfigBar";
import store, {
  useUrlState,
} from "../../../components/PlaygroundFeatures/store";
import { Provider } from "react-redux";
import BrowserOnly from "@docusaurus/BrowserOnly";
import FillRemainingHeight from "../../../components/PlaygroundFeatures/FillRemainingHeight";
import { bindGratsToStore } from "../../../components/PlaygroundFeatures/gratsStoreBindings";
import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";
import InputEditor from "../../../components/MonacoPlayground/InputEditor";
import OutputEditor from "../../../components/MonacoPlayground/OutputEditor";

if (ExecutionEnvironment.canUseDOM) {
  bindGratsToStore();
}

export default function EditorView() {
  useUrlState(store);
  return (
    <Layout title={`Playground`} noFooter>
      <BrowserOnly>
        {() => (
          <FillRemainingHeight minHeight={300}>
            <Provider store={store}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <ConfigBar />
                <div
                  style={{
                    flexGrow: 1,
                    position: "relative",
                    top: 0,
                    left: 0,
                    right: 0,
                    display: "flex",
                    flexDirection: "row",
                    overflow: "scroll",
                  }}
                >
                  <InputEditor />
                  <OutputEditor />
                </div>
              </div>
            </Provider>
          </FillRemainingHeight>
        )}
      </BrowserOnly>
    </Layout>
  );
}
