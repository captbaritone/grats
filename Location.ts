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
