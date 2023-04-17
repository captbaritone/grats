import * as ts from "typescript";

// Recursively search for all JSDoc tags calling `cb` on each one with its
// direct parent node.
export function traverseJSDocTags(
  node: ts.Node,
  cb: (parent: ts.Node, tag: ts.JSDocTag) => void,
) {
  // Typescript only has an API to get the JSDoc tags for a node AND all of its
  // parents. So, we rely on the fact that we are recursing breadth-first and
  // only call the callback the first time we encounter a tag.  This should
  // ensure we only ever call the callback once per tag, and that we call it
  // with the tag's "true" parent node.
  const seenTags: Set<ts.JSDocTag> = new Set();

  // Inner function to avoid passing seenTags around
  function inner(node: ts.Node) {
    for (const tag of ts.getJSDocTags(node)) {
      if (seenTags.has(tag)) {
        break;
      }
      seenTags.add(tag);
      cb(node, tag);
    }
    // Recurse into children
    ts.forEachChild(node, inner);
  }

  inner(node);
}
