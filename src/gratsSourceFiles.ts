import * as ts from "typescript";

const TAG_REGEX = /@(gql)|(killsParentOnException)/i;

// Given a ts.Program, find the files to extract GraphQL definitions from.
// In the future this part might be able to be incremental, were we only run extraction
// on changed files.
//
// The Rust side checks these files for syntax errors. See `run` in
// `grats-rs/crates/grats/src/pipeline.rs`.
export function gratsSourceFilesFromProgram(
  program: ts.Program,
): ts.SourceFile[] {
  // If the file doesn't contain any GraphQL definitions, skip it.
  return program
    .getSourceFiles()
    .filter((sourceFile) => TAG_REGEX.test(sourceFile.text));
}
