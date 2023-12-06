import React from "react";
import GraphQLOutputView from "./GraphqlOutputView";
import CodegenOutputView from "./CodegenOutputView";
import { getOutputOption, useAppSelector } from "../store";

export default function OutputView() {
  const outputOption = useAppSelector(getOutputOption);
  switch (outputOption) {
    case "sdl":
      return <GraphQLOutputView />;
    case "typescript":
      return <CodegenOutputView />;
  }
}
