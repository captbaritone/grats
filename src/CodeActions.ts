import * as ts from "typescript";

export function prefixNode(node: ts.Node, prefix: string): ts.FileTextChanges {
  const start = node.getStart();
  return {
    fileName: node.getSourceFile().fileName,
    textChanges: [{ span: { start, length: 0 }, newText: prefix }],
  };
}

export function removeNode(node: ts.Node): ts.FileTextChanges {
  const start = node.getStart();
  const length = node.getEnd() - start;
  return {
    fileName: node.getSourceFile().fileName,
    textChanges: [{ span: { start, length }, newText: "" }],
  };
}

export function replaceNode(node: ts.Node, newText): ts.FileTextChanges {
  const start = node.getStart();
  const length = node.getEnd() - start;
  return {
    fileName: node.getSourceFile().fileName,
    textChanges: [{ span: { start, length }, newText }],
  };
}
