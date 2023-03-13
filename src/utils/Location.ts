import { Location as GraphQLLocation } from "graphql";
import * as ts from "typescript";
export type Position = { offset: number; line: number; column: number };

export type Location = {
  start: Position;
  end: Position;
  filepath: string;
};

export function fromGraphQLLocation(gqlLoc: GraphQLLocation): Location {
  return {
    start: {
      offset: gqlLoc.start,
      line: gqlLoc.startToken.line + 1,
      column: gqlLoc.startToken.column + 1,
    },
    end: {
      offset: gqlLoc.end,
      line: gqlLoc.endToken.line + 1,
      column: gqlLoc.endToken.column + 1,
    },
    filepath: gqlLoc.source.name,
  };
}

export function firstChar(location: Location): Location {
  return {
    start: location.start,
    end: {
      offset: location.start.offset + 1,
      line: location.start.line,
      column: location.start.column + 1,
    },
    filepath: location.filepath,
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
    filepath: location.filepath,
  };
}

export function union(start: Location, end: Location): Location {
  if (start.filepath !== end.filepath)
    throw new Error("Cannot union locations from different files");
  return { start: start.start, end: end.end, filepath: start.filepath };
}

// TS AST Location => Diagnostic Location
// GraphQL Location => Diagnostic Location
