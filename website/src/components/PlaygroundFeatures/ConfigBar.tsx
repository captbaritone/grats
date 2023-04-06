import React from "react";
import store, {
  getNullableByDefault,
  getShowGratsDirectives,
  useAppSelector,
} from "./store";
import FormatButton from "./FormatButton";
import ShareButton from "./ShareButton";

export default function ConfigBar(): JSX.Element {
  const nullableByDefault = useAppSelector(getNullableByDefault);
  const showGratsDirectives = useAppSelector(getShowGratsDirectives);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "stretch",
        alignItems: "center",
        borderBottom: "1px solid var(--ifm-color-emphasis-300)",
        fontFamily: "Verdana, sans-serif",
        fontSize: "0.8rem",
        position: "sticky",
        bottom: 0,
        backgroundColor: "var(--ifm-color-emphasis-100)",
      }}
    >
      <ConfigBarSide>
        <ConfigBlock>
          <ConfigBarHeading>Grats config:</ConfigBarHeading>
          <Label>
            <input
              checked={nullableByDefault}
              type="checkbox"
              onChange={(e) => {
                store.dispatch({
                  type: "DEFAULT_NULLABLE_INPUT_CHANGED",
                  value: e.target.checked,
                });
              }}
            />
            Make fields nullable by default
          </Label>
        </ConfigBlock>
        <div style={{ display: "flex", gap: "1em" }}>
          <FormatButton store={store} />
          <ShareButton store={store} />
        </div>
      </ConfigBarSide>
      <ConfigBarSide>
        <ConfigBlock>
          <ConfigBarHeading>View options:</ConfigBarHeading>
          <Label>
            <input
              checked={showGratsDirectives}
              type="checkbox"
              onChange={(e) => {
                console.log(e.target.checked);
                store.dispatch({
                  type: "SHOW_GRATS_DIRECTIVE_INPUT_CHANGED",
                  value: e.target.checked,
                });
              }}
            />
            Show Grats directives
          </Label>
        </ConfigBlock>
        <div
          style={{
            color: "#666",
            whiteSpace: "nowrap",
          }}
        >
          Version: Pre-release Alpha
        </div>
      </ConfigBarSide>
    </div>
  );
}

function Label({ children }) {
  return (
    <label style={{ display: "flex", alignItems: "center" }}>{children}</label>
  );
}

function ConfigBlock({ children }) {
  return (
    <div
      style={{
        width: "100%",
        flexGrow: 1,
        display: "flex",
        flexDirection: "row",
      }}
    >
      {children}
    </div>
  );
}

function ConfigBarSide({ children }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
        flexGrow: 1,
        padding: "0.5rem 1rem",
        alignItems: "center",
      }}
    >
      {children}
    </div>
  );
}

function ConfigBarHeading({ children }) {
  return (
    <strong
      style={{
        color: "#666",
        padding: "0 0.2rem 0 0",
      }}
    >
      {children}
    </strong>
  );
}
