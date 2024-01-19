import * as ts from "typescript";
import { rangeErr } from "./utils/DiagnosticError";
import * as E from "./Errors";
import { ALL_TAGS, KILLS_PARENT_ON_EXCEPTION_TAG } from "./Extractor";

// A line that starts with optional *s followed by @gql or @killsParentOnException
const BLOCK_COMMENT_REGEX =
  /^(\s*\**\s*)(@((gql[a-z]*)|(killsParentOnException)))/i;

// Report helpful errors when tags are used in invalid positions
// such as non JSDoc block comments or line comments.
export function detectInvalidComments(
  sourceFile: ts.SourceFile,
  validCommentPositions: Set<number>,
): ts.Diagnostic[] {
  const errors: ts.Diagnostic[] = [];
  forEachComment(sourceFile, (fullText, comment) => {
    if (validCommentPositions.has(comment.pos)) {
      return;
    }

    const isLine = comment.kind === ts.SyntaxKind.SingleLineCommentTrivia;

    const start = comment.pos + 2; // Skip the // or /*
    const end = comment.end - (isLine ? 0 : 2); // Maybe skip the */ at the end

    const textSlice = fullText.slice(start, end);
    const tags = getGratsAdjacentTags(textSlice, comment);
    if (tags.length === 0) {
      return;
    }
    for (const { tagName, range } of tags) {
      if (!isGratsDocblockTag(tagName)) {
        errors.push(rangeErr(sourceFile, range, E.invalidGratsTag(tagName)));
      }
      if (isLine) {
        errors.push(rangeErr(sourceFile, range, E.gqlTagInLineComment()));
      } else {
        if (textSlice[0] !== "*") {
          errors.push(
            rangeErr(sourceFile, range, E.gqlTagInNonJSDocBlockComment()),
          );
        } else {
          errors.push(
            rangeErr(sourceFile, range, E.gqlTagInDetachedJSDocBlockComment()),
          );
        }
      }
    }
  });
  return errors;
}

// Extract @gql or @killsParentOnException tags from a JSDoc block comment.
// along with their positions.
function getGratsAdjacentTags(
  text: string,
  commentRange: ts.CommentRange,
): { tagName: string; range: ts.CommentRange }[] {
  let offset = 0;
  const lines = text.split("\n");

  const tags: { tagName: string; range: ts.CommentRange }[] = [];
  for (const line of lines) {
    const match = BLOCK_COMMENT_REGEX.exec(line);
    if (match == null) {
      offset += line.length + 1;
      continue;
    }
    const [, prefix, tag] = match;
    const pos = commentRange.pos + 2 + offset + prefix.length;
    const end = pos + tag.length;
    const range = { kind: commentRange.kind, pos, end };
    const tagName = tag.slice(1); // Trim the @
    tags.push({ tagName, range });
  }
  return tags;
}

function isGratsDocblockTag(tag: string) {
  return ALL_TAGS.includes(tag) || tag === KILLS_PARENT_ON_EXCEPTION_TAG;
}

// Functions below this point were copied/modified from `ts-api-utils`. Thanks!
// https://github.com/JoshuaKGoldberg/ts-api-utils/blob/fcd3128b61dfb54978b30f07380ad1c87a5d093e/src/comments.ts

/**
 * TypeScript does not provide a way to iterate over comments, so this function
 * provides a way to iterate over all comments in a source file.
 */
export function forEachComment(
  sourceFile: ts.SourceFile,
  callback: (fullText: string, comment: ts.CommentRange) => void,
): void {
  const fullText = sourceFile.text;
  const notJsx = sourceFile.languageVariant !== ts.LanguageVariant.JSX;
  return forEachToken(sourceFile, (token) => {
    if (token.pos === token.end) {
      return;
    }

    if (token.kind !== ts.SyntaxKind.JsxText) {
      ts.forEachLeadingCommentRange(
        fullText,
        // skip shebang at position 0
        token.pos === 0 ? (ts.getShebang(fullText) ?? "").length : token.pos,
        commentCallback,
      );
    }

    if (notJsx || canHaveTrailingTrivia(token)) {
      return ts.forEachTrailingCommentRange(
        fullText,
        token.end,
        commentCallback,
      );
    }
  });
  function commentCallback(pos: number, end: number, kind: ts.CommentKind) {
    callback(fullText, { end, kind, pos });
  }
}

type ForEachTokenCallback = (token: ts.Node) => void;

function forEachToken(
  sourceFile: ts.SourceFile,
  callback: ForEachTokenCallback,
): void {
  const queue: ts.Node[] = [];
  let node: ts.Node = sourceFile;
  while (true) {
    if (ts.isTokenKind(node.kind)) {
      callback(node);
    } else if (node.kind === ts.SyntaxKind.JSDocComment) {
      // Ignore for support of TS < 4.7
    } else {
      const children = node.getChildren(sourceFile);
      if (children.length === 1) {
        node = children[0];
        continue;
      }

      // add children in reverse order, when we pop the next element from the queue, it's the first child
      for (let i = children.length - 1; i >= 0; --i) {
        queue.push(children[i]);
      }
    }

    const next = queue.pop();
    if (next == null) {
      break;
    } else {
      node = next;
    }
  }
}

function canHaveTrailingTrivia(token: ts.Node): boolean {
  switch (token.kind) {
    case ts.SyntaxKind.CloseBraceToken:
      // after a JsxExpression inside a JsxElement's body can only be other JsxChild, but no trivia
      return (
        token.parent.kind !== ts.SyntaxKind.JsxExpression ||
        !isJsxElementOrFragment(token.parent.parent)
      );
    case ts.SyntaxKind.GreaterThanToken:
      switch (token.parent.kind) {
        case ts.SyntaxKind.JsxOpeningElement:
          // if end is not equal, this is part of the type arguments list. in all other cases it would be inside the element body
          return token.end !== token.parent.end;
        case ts.SyntaxKind.JsxOpeningFragment:
          return false; // would be inside the fragment
        case ts.SyntaxKind.JsxSelfClosingElement:
          return (
            token.end !== token.parent.end || // if end is not equal, this is part of the type arguments list
            !isJsxElementOrFragment(token.parent.parent)
          ); // there's only trailing trivia if it's the end of the top element
        case ts.SyntaxKind.JsxClosingElement:
        case ts.SyntaxKind.JsxClosingFragment:
          // there's only trailing trivia if it's the end of the top element
          return !isJsxElementOrFragment(token.parent.parent.parent);
      }
  }

  return true;
}

function isJsxElementOrFragment(
  node: ts.Node,
): node is ts.JsxElement | ts.JsxFragment {
  return (
    node.kind === ts.SyntaxKind.JsxElement ||
    node.kind === ts.SyntaxKind.JsxFragment
  );
}
