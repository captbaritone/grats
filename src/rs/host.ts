import { Source } from "graphql";
import * as path from "path";
import * as ts from "typescript";
import type { SourceTable } from "./codec.js";

/**
 * What the Rust port of Grats asks of its host about the program's files,
 * answered from the `ts.Program` until Rust owns the file set. See `Host` in
 * `grats-rs/crates/grats/src/host.rs`.
 */
export type HostRequest =
  | { kind: "sourceFile"; source: number }
  | { kind: "readFile"; path: string }
  | { kind: "resolveModule"; from: string; specifier: string }
  | { kind: "globalFiles"; name: string }
  | { kind: "addSource"; name: string; body: string };

/** A response to a `HostRequest`, as JSON. */
export type Host = (request: HostRequest) => unknown;

type HostFile = {
  source: number;
  path: string;
  text: string;
  isModule: boolean;
};

/**
 * The path of a file in the program, as Rust is given it. Rust has no working
 * directory to resolve paths against, so it's given absolute paths, but a
 * program's root file names may be relative.
 */
export function hostPath(fileName: string): string {
  return path.isAbsolute(fileName) ? fileName : path.resolve(fileName);
}

export function programHost(program: ts.Program, sources: SourceTable): Host {
  const hostFile = (sourceFile: ts.SourceFile): HostFile => ({
    // Locations in diagnostics refer to the file by its name in the program.
    source: sources.sourceId(new Source(sourceFile.text, sourceFile.fileName)),
    path: hostPath(sourceFile.fileName),
    text: sourceFile.text,
    isModule: ts.isExternalModule(sourceFile),
  });
  let globalFiles: Map<string, string[]> | null = null;

  return (request) => {
    switch (request.kind) {
      case "sourceFile": {
        const { name } = sources.source(request.source);
        return hostFile(getSourceFile(program, name));
      }
      case "readFile": {
        const sourceFile = program.getSourceFile(request.path);
        return sourceFile == null ? null : hostFile(sourceFile);
      }
      case "resolveModule":
        return resolveModule(program, request.from, request.specifier);
      case "globalFiles":
        globalFiles ??= indexGlobalFiles(program);
        return globalFiles.get(request.name) ?? [];
      case "addSource":
        return sources.sourceId(new Source(request.body, request.name));
    }
  };
}

function getSourceFile(program: ts.Program, path: string): ts.SourceFile {
  const sourceFile = program.getSourceFile(path);
  if (sourceFile == null) {
    throw new Error(`Could not find source file "${path}".`);
  }
  return sourceFile;
}

/**
 * The path of the file in the program which `specifier` resolves to when
 * imported by `from`, as the program resolved it.
 */
function resolveModule(
  program: ts.Program,
  from: string,
  specifier: string,
): string | null {
  const sourceFile = getSourceFile(program, from);
  // @ts-ignore `imports` is internal: the module specifiers in the file.
  const imports: readonly ts.StringLiteralLike[] = sourceFile.imports;
  const moduleSpecifier = imports.find((literal) => literal.text === specifier);
  if (moduleSpecifier == null) {
    return null;
  }
  const resolved: ts.ResolvedModuleWithFailedLookupLocations | undefined =
    // @ts-ignore Internal, but what the checker uses to resolve imports.
    program.getResolvedModuleFromModuleSpecifier(moduleSpecifier, sourceFile);
  const fileName = resolved?.resolvedModule?.resolvedFileName;
  if (fileName == null) {
    return null;
  }
  const resolvedFile = program.getSourceFile(fileName);
  return resolvedFile == null ? null : hostPath(resolvedFile.fileName);
}

/**
 * Indexes the files which may declare each name in the global scope, in the
 * order in which the checker merges their declarations: files which aren't
 * modules (including lib files), followed by modules with `declare global`
 * blocks.
 */
function indexGlobalFiles(program: ts.Program): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const add = (
    sourceFile: ts.SourceFile,
    statements: readonly ts.Statement[],
  ) => {
    for (const name of new Set(statements.flatMap(declaredNames))) {
      let files = index.get(name);
      if (files == null) {
        files = [];
        index.set(name, files);
      }
      files.push(hostPath(sourceFile.fileName));
    }
  };
  const sourceFiles = program.getSourceFiles();
  for (const sourceFile of sourceFiles) {
    if (!ts.isExternalModule(sourceFile)) {
      add(sourceFile, sourceFile.statements);
    }
  }
  for (const sourceFile of sourceFiles) {
    if (!ts.isExternalModule(sourceFile)) {
      continue;
    }
    for (const statement of sourceFile.statements) {
      if (
        ts.isModuleDeclaration(statement) &&
        statement.flags & ts.NodeFlags.GlobalAugmentation &&
        statement.body != null &&
        ts.isModuleBlock(statement.body)
      ) {
        add(sourceFile, statement.body.statements);
      }
    }
  }
  return index;
}

function declaredNames(statement: ts.Statement): string[] {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
    );
  }
  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isModuleDeclaration(statement) ||
    ts.isImportEqualsDeclaration(statement)
  ) {
    return statement.name != null && ts.isIdentifier(statement.name)
      ? [statement.name.text]
      : [];
  }
  return [];
}
