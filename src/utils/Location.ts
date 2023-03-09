import type { TSESTree } from "@typescript-eslint/types";
import {
  Location as GraphQLLocation,
  Token as GraphQLToken,
  Source as GraphQLSource,
  TokenKind as GraphQLTokenKind,
} from "graphql";
export type Position = { offset: number; line: number; column: number };

export type Location = {
  start: Position;
  end: Position;
};

export function firstChar(location: Location): Location {
  return {
    start: location.start,
    end: {
      offset: location.start.offset + 1,
      line: location.start.line,
      column: location.start.column + 1,
    },
  };
}
export function lastChar(location: Location): Location {
  return {
    start: {
      offset: location.end.offset - 1,
      line: location.end.line,
      column: location.end.column - 1,
    },
    end: location.end,
  };
}

export function union(start: Location, end: Location): Location {
  return { start: start.start, end: end.end };
}

// TS AST Location => GraphQL Location
export function tsLocToGraphQLLoc(
  tsLoc: TSESTree.SourceLocation,
  source: string,
): GraphQLLocation {
  const startToken = tsPositionToGraphQLToken(tsLoc.start, source);
  const endToken = tsPositionToGraphQLToken(tsLoc.end, source);
  const graphQLsource = new GraphQLSource(source, "dummy.ts");
  return new GraphQLLocation(startToken, endToken, graphQLsource);
}

function tsPositionToGraphQLToken(
  position: TSESTree.Position,
  source,
): GraphQLToken {
  const start =
    lineAndColumnToOffset(position.line, position.column, source) + 1;
  const end = start + 1;
  return new GraphQLToken(
    GraphQLTokenKind.SOF,
    start,
    end,
    position.line,
    position.column,
    "DUMMY_TOKEN",
  );
}

// Compute the byte offset of a line and column in a string
function lineAndColumnToOffset(
  line: number,
  column: number,
  source: string,
): number {
  return (
    source
      .split("\n")
      .slice(0, line - 1)
      .join("\n").length + column
  );
}

// TS AST Location => Diagnostic Location
// GraphQL Location => Diagnostic Location
