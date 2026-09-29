import { Location } from "graphql";
import * as ts from "typescript";

/**
 * Finds the TypeScript AST node at a location recorded in an
 * `ExtractionSnapshot`, so that the type checker can be asked about it.
 */
export class NodeLocator {
  constructor(private program: ts.Program) {}

  /** Returns the innermost node which spans exactly `loc`. */
  nodeAt(loc: Location): ts.Node {
    const sourceFile = this.program.getSourceFile(loc.source.name);
    if (sourceFile == null) {
      throw new Error(`Could not find source file "${loc.source.name}".`);
    }
    let found: ts.Node | null = null;
    let node: ts.Node | undefined = sourceFile;
    while (node != null) {
      if (node.end === loc.end && node.getStart(sourceFile) === loc.start) {
        found = node;
      }
      node = ts.forEachChild(node, (child) =>
        child.pos <= loc.start && loc.end <= child.end ? child : undefined,
      );
    }
    if (found == null) {
      throw new Error(
        `Could not find node at ${loc.source.name}:${loc.start}-${loc.end}.`,
      );
    }
    return found;
  }
}
