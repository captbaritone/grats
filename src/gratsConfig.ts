import * as ts from "typescript";

export type GratsConfig = {
  // Where Grats should write your schema file. Path is relative to the
  // `tsconfig.json` file.
  graphqlSchema: string; // Defaults to `./schema.graphql`

  // Where Grats should write your executable TypeScript schema file. Path is
  // relative to the `tsconfig.json` file.
  tsSchema: string; // Defaults to `./schema.ts`

  // Should all fields be typed as nullable in accordance with GraphQL best
  // practices?
  // https://graphql.org/learn/best-practices/#nullability
  //
  // Individual fields can declare themselves as non-nullable by adding the
  // docblock tag `@killsParentOnException`.
  nullableByDefault: boolean; // Default: true

  // Experimental feature to add `@semanticNonNull` to all fields which have
  // non-null TypeScript return types, but which are made nullable by the
  // `nullableByDefault` option.
  //
  // This feature allows clients which handle errors out of band, for example
  // by discarding responses with errors, to know which fields are expected to
  // be non-null in the absence of errors.
  //
  // See https://grats.capt.dev/docs/guides/strict-semantic-nullability
  //
  // It is an error to enable `semanticNullability` if `nullableByDefault` is
  // false.
  strictSemanticNullability: boolean; // Default: false

  // Should Grats error if it encounters a TypeScript type error?
  // Note that Grats will always error if it encounters a TypeScript syntax
  // error.
  reportTypeScriptTypeErrors: boolean; // Default: false

  // A string to prepend to the generated schema text. Useful for copyright
  // headers or other information to the generated file. Set to `null` to omit
  // the default header.
  schemaHeader: string | null; // Defaults to info about Grats

  // A string to prepend to the generated TypeScript schema file. Useful for copyright
  // headers or other information to the generated file. Set to `null` to omit
  // the default header.
  tsSchemaHeader: string | null; // Defaults to info about Grats

  // This option allows you configure an extension that will be appended
  // to the end of all import paths in the generated TypeScript schema file.
  // When building a package that uses ES modules, import paths must not omit the
  // file extension. In TypeScript code this generally means import paths must end
  // with `.js`. If set to null, no ending will be appended.
  importModuleSpecifierEnding: string; // Defaults to no ending, or ""

  // EXPERIMENTAL: THIS OPTION WILL BE RENAMED OR REMOVED IN A FUTURE RELEASE
  // Emit a JSON file alongside the generated schema file which contains the
  // metadata containing information about the resolvers.
  EXPERIMENTAL__emitMetadata: boolean; // Default: false

  // EXPERIMENTAL: THIS OPTION WILL BE RENAMED OR REMOVED IN A FUTURE RELEASE
  // Instead of emitting a TypeScript file which creates a GraphQLSchema, emit
  // a TypeScript file which creates a GraphQL Tools style Resolver Map.
  // https://the-guild.dev/graphql/tools/docs/resolvers#resolver-map
  EXPERIMENTAL__emitResolverMap: boolean; // Default: false
};

export type ParsedCommandLineGrats = Omit<ts.ParsedCommandLine, "raw"> & {
  raw: {
    grats: GratsConfig;
  };
};

const DEFAULT_SDL_HEADER = `# Schema generated by Grats (https://grats.capt.dev)
# Do not manually edit. Regenerate by running \`npx grats\`.`;

const DEFAULT_TYPESCRIPT_HEADER = `/**
 * Executable schema generated by Grats (https://grats.capt.dev)
 * Do not manually edit. Regenerate by running \`npx grats\`.
 */`;

const VALID_CONFIG_KEYS = new Set([
  "graphqlSchema",
  "tsSchema",
  "nullableByDefault",
  "strictSemanticNullability",
  "reportTypeScriptTypeErrors",
  "schemaHeader",
  "tsSchemaHeader",
  "importModuleSpecifierEnding",
  "EXPERIMENTAL__emitMetadata",
  "EXPERIMENTAL__emitResolverMap",
]);

// TODO: Make this return diagnostics
export function validateGratsOptions(
  options: ts.ParsedCommandLine,
): ParsedCommandLineGrats {
  const gratsOptions = { ...(options.raw?.grats ?? {}) };
  for (const key of Object.keys(gratsOptions)) {
    if (!VALID_CONFIG_KEYS.has(key)) {
      // TODO: Suggest similar?
      throw new Error(`Grats: Unknown Grats config option \`${key}\``);
    }
  }
  if (gratsOptions.nullableByDefault === undefined) {
    gratsOptions.nullableByDefault = true;
  } else if (typeof gratsOptions.nullableByDefault !== "boolean") {
    throw new Error(
      "Grats: The Grats config option `nullableByDefault` must be a boolean if provided.",
    );
  }
  if (gratsOptions.strictSemanticNullability === undefined) {
    gratsOptions.strictSemanticNullability = false;
  } else if (typeof gratsOptions.strictSemanticNullability !== "boolean") {
    throw new Error(
      "Grats: The Grats config option `strictSemanticNullability` must be a boolean if provided.",
    );
  } else if (
    gratsOptions.strictSemanticNullability &&
    !gratsOptions.nullableByDefault
  ) {
    throw new Error(
      "Grats: The Grats config option `strictSemanticNullability` cannot be true if `nullableByDefault` is false.",
    );
  }
  if (gratsOptions.reportTypeScriptTypeErrors === undefined) {
    gratsOptions.reportTypeScriptTypeErrors = false;
  } else if (typeof gratsOptions.reportTypeScriptTypeErrors !== "boolean") {
    throw new Error(
      "Grats: The Grats config option `reportTypeScriptTypeErrors` must be a boolean if provided.",
    );
  }

  if (gratsOptions.graphqlSchema === undefined) {
    gratsOptions.graphqlSchema = "./schema.graphql";
  } else if (
    typeof gratsOptions.graphqlSchema !== "string" &&
    gratsOptions.graphqlSchema !== null
  ) {
    throw new Error(
      "Grats: The Grats config option `graphqlSchema` must be a string if provided.",
    );
  }

  if (gratsOptions.tsSchema === undefined) {
    gratsOptions.tsSchema = "./schema.ts";
  } else if (
    typeof gratsOptions.tsSchema !== "string" &&
    gratsOptions.tsSchema !== null
  ) {
    throw new Error(
      "Grats: The Grats config option `tsSchema` must be a string if provided.",
    );
  }

  if (gratsOptions.schemaHeader === undefined) {
    gratsOptions.schemaHeader = DEFAULT_SDL_HEADER;
  } else if (Array.isArray(gratsOptions.schemaHeader)) {
    if (
      !gratsOptions.schemaHeader.every((segment) => typeof segment === "string")
    ) {
      throw new Error(
        "Grats: If the Grats config option `schemaHeader` is an array, it must be an array of strings.",
      );
    }
    gratsOptions.schemaHeader = gratsOptions.schemaHeader.join("");
  } else if (
    typeof gratsOptions.schemaHeader !== "string" &&
    gratsOptions.schemaHeader !== null
  ) {
    throw new Error(
      "Grats: The Grats config option `schemaHeader` must be a string, an array of strings, or `null` if provided.",
    );
  }

  if (gratsOptions.tsSchemaHeader === undefined) {
    gratsOptions.tsSchemaHeader = DEFAULT_TYPESCRIPT_HEADER;
  } else if (Array.isArray(gratsOptions.tsSchemaHeader)) {
    if (
      !gratsOptions.tsSchemaHeader.every(
        (segment) => typeof segment === "string",
      )
    ) {
      throw new Error(
        "Grats: If the Grats config option `tsSchemaHeader` is an array, it must be an array of strings.",
      );
    }
    gratsOptions.tsSchemaHeader = gratsOptions.tsSchemaHeader.join("");
  } else if (
    typeof gratsOptions.tsSchemaHeader !== "string" &&
    gratsOptions.tsSchemaHeader !== null
  ) {
    throw new Error(
      "Grats: The Grats config option `tsSchemaHeader` must be a string, an array of strings, or `null` if provided.",
    );
  }

  if (gratsOptions.importModuleSpecifierEnding === undefined) {
    gratsOptions.importModuleSpecifierEnding = "";
  } else if (typeof gratsOptions.importModuleSpecifierEnding !== "string") {
    throw new Error(
      "Grats: The Grats config option `importModuleSpecifierEnding` must be a string if provided.",
    );
  }

  if (gratsOptions.EXPERIMENTAL__emitMetadata === undefined) {
    gratsOptions.EXPERIMENTAL__emitMetadata = false;
  } else if (typeof gratsOptions.EXPERIMENTAL__emitMetadata !== "boolean") {
    throw new Error(
      "Grats: The Grats config option `EXPERIMENTAL__emitMetadata` must be a boolean if provided.",
    );
  } else {
    console.warn(
      "Grats: The `EXPERIMENTAL__emitMetadata` option is experimental and will be renamed or removed in a future release.",
    );
  }

  if (gratsOptions.EXPERIMENTAL__emitResolverMap === undefined) {
    gratsOptions.EXPERIMENTAL__emitResolverMap = false;
  } else if (typeof gratsOptions.EXPERIMENTAL__emitResolverMap !== "boolean") {
    throw new Error(
      "Grats: The Grats config option `EXPERIMENTAL__emitResolverMap` must be a boolean if provided.",
    );
  } else {
    console.warn(
      "Grats: The `EXPERIMENTAL__emitResolverMap` option is experimental and will be renamed or removed in a future release.",
    );
  }

  return {
    ...options,
    raw: { ...options.raw, grats: gratsOptions },
  };
}
