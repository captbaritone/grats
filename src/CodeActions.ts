import * as ts from "typescript";

export function prefixNode(node: ts.Node, prefix: string): ts.FileTextChanges {
  const start = node.getStart();
  return {
    fileName: node.getSourceFile().fileName,
    textChanges: [{ span: { start, length: 0 }, newText: prefix }],
  };
}

export function suffixNode(node: ts.Node, suffix: string): ts.FileTextChanges {
  const end = node.getEnd();
  return {
    fileName: node.getSourceFile().fileName,
    textChanges: [{ span: { start: end, length: 0 }, newText: suffix }],
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

export function replaceNode(
  node: ts.Node,
  newText: string,
): ts.FileTextChanges {
  const start = node.getStart();
  const length = node.getEnd() - start;
  return {
    fileName: node.getSourceFile().fileName,
    textChanges: [{ span: { start, length }, newText }],
  };
}

export function convertLineCommentToDocblock(
  sourceFile: ts.SourceFile,
  comment: ts.CommentRange,
): ts.FileTextChanges {
  return {
    fileName: sourceFile.fileName,
    textChanges: [
      { span: { start: comment.pos, length: 2 }, newText: "/**" },
      { span: { start: comment.end, length: 0 }, newText: " */" },
    ],
  };
}
export function convertBlockCommentToDocblock(
  sourceFile: ts.SourceFile,
  comment: ts.CommentRange,
): ts.FileTextChanges {
  return {
    fileName: sourceFile.fileName,
    textChanges: [{ span: { start: comment.pos, length: 2 }, newText: "/**" }],
  };
}
