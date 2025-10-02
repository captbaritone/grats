import { GraphQLEnumType, GraphQLSchema, isEnumType } from "graphql";
import * as ts from "typescript";
import { GratsConfig } from "../gratsConfig.js";
import { nullThrows } from "../utils/helpers";
import TSAstBuilder from "./TSAstBuilder";

const F = ts.factory;

// Given a GraphQL schema, returns TypeScript code that exports all enums
// as a single object mapping enum names to their TypeScript values.
export function codegenEnums(
  schema: GraphQLSchema,
  config: GratsConfig,
  destination: string,
): string {
  const codegen = new EnumCodegen(schema, config, destination);
  return codegen.generate();
}

class EnumCodegen {
  ts: TSAstBuilder;
  _enumImports: Map<
    string,
    { tsModulePath: string; exportName: string | null; localName: string }
  > = new Map();

  constructor(
    public _schema: GraphQLSchema,
    config: GratsConfig,
    destination: string,
  ) {
    this.ts = new TSAstBuilder(destination, config.importModuleSpecifierEnding);
  }

  generate(): string {
    // Collect all user-defined enum types (filter out built-in/introspection enums)
    const enumTypes = Object.values(this._schema.getTypeMap()).filter(
      (type): type is GraphQLEnumType =>
        isEnumType(type) && !type.name.startsWith("__"), // Filter out introspection types
    );

    // Collect enum export information and import statements
    for (const enumType of enumTypes) {
      this.collectEnumExports(enumType);
    }

    // Generate the enums export object
    this.generateEnumsObject(enumTypes);

    return this.ts.print();
  }

  private collectEnumExports(enumType: GraphQLEnumType): void {
    // Assert that astNode and exported info are present - this should be guaranteed by validation
    const astNode = nullThrows(enumType.astNode);
    const exported = nullThrows(astNode.exported);

    const localName = `${enumType.name}Enum`;
    this._enumImports.set(enumType.name, {
      tsModulePath: exported.tsModulePath,
      exportName: exported.exportName,
      localName,
    });

    // Import the enum
    this.ts.importUserConstruct(
      exported.tsModulePath,
      exported.exportName,
      localName,
    );
  }

  private generateEnumsObject(enumTypes: GraphQLEnumType[]): void {
    // All enums should have import information at this point
    const enumProperties = enumTypes.map((enumType) => {
      const { localName } = nullThrows(this._enumImports.get(enumType.name));
      return F.createPropertyAssignment(
        enumType.name,
        F.createIdentifier(localName),
      );
    });

    // Create the exported enums object
    this.ts.addStatement(
      F.createVariableStatement(
        [F.createModifier(ts.SyntaxKind.ExportKeyword)],
        F.createVariableDeclarationList(
          [
            F.createVariableDeclaration(
              "enums",
              undefined,
              undefined,
              F.createObjectLiteralExpression(enumProperties, true),
            ),
          ],
          ts.NodeFlags.Const,
        ),
      ),
    );

    // Also export individual enums for convenience
    for (const enumType of enumTypes) {
      const { localName } = nullThrows(this._enumImports.get(enumType.name));
      this.ts.addStatement(
        F.createExportDeclaration(
          undefined,
          false,
          F.createNamedExports([
            F.createExportSpecifier(false, localName, enumType.name),
          ]),
        ),
      );
    }
  }
}
