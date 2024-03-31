import React, { useLayoutEffect, useState } from "react";
import InputView from "../../components/PlaygroundFeatures/editors/InputView";
import OutputView from "../../components/PlaygroundFeatures/editors/OutputView";
import ConfigBar from "../../components/PlaygroundFeatures/ConfigBar";
import Layout from "@theme/Layout";
import store from "../../components/PlaygroundFeatures/store";
import { Provider } from "react-redux";
import BrowserOnly from "@docusaurus/BrowserOnly";

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

// On mount, measures the window height and current vertical offset, and
// renders children into a div that stretches to the bottom of the viewport.
function FillRemainingHeight({ children, minHeight }) {
  const [containerRef, setContainerRef] = useState(null);
  const [height, setHeight] = useState(null);
  useLayoutEffect(() => {
    if (containerRef == null) {
      return;
    }

    function updateSize() {
      const verticalOffset = containerRef.getBoundingClientRect().y;
      const available = Math.max(
        window.innerHeight - verticalOffset,
        minHeight,
      );
      setHeight(available);
    }

    updateSize();

    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [containerRef, minHeight]);

  return (
    <div style={{ height }} ref={setContainerRef}>
      {height != null && children}
    </div>
  );
}
