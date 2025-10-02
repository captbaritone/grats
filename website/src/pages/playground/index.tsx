import React from "react";
import InputView from "../../components/PlaygroundFeatures/editors/InputView";
import OutputView from "../../components/PlaygroundFeatures/editors/OutputView";
import ConfigBar from "../../components/PlaygroundFeatures/ConfigBar";
import Layout from "@theme/Layout";
import store from "../../components/PlaygroundFeatures/store";
import { Provider } from "react-redux";
import BrowserOnly from "@docusaurus/BrowserOnly";
import FillRemainingHeight from "@site/src/components/FillRemainingHeight";

export default function Playground(): JSX.Element {
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
                  <InputView />
                  <OutputView />
                </div>
              </div>
            </Provider>
          </FillRemainingHeight>
        )}
      </BrowserOnly>
    </Layout>
  );
}
