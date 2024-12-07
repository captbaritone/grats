import React from "react";
import GraphQLOutputView from "./GraphQLOutputView";
import CodegenOutputView from "./CodegenOutputView";
import { getOutputOption, useAppSelector } from "../store";
import ResolverSignatureOutput from "./ResolverSignatureOutput";

export default function OutputView() {
  const outputOption = useAppSelector(getOutputOption);
  switch (outputOption) {
    case "sdl":
      return <GraphQLOutputView />;
    case "typescript":
      return <CodegenOutputView />;
    case "resolverSignatures":
      return <ResolverSignatureOutput />;
  }
}
