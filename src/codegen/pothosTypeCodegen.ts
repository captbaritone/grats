import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
} from "graphql";
import * as ts from "typescript";
import TSAstBuilder from "./TSAstBuilder";
import { GratsConfig } from "../TGratsConfig";
import { nullThrows } from "../utils/helpers";
import { ExportDefinition } from "../GraphQLAstExtensions";

const BUILT_IN_SCALARS = new Set(["String", "Int", "Float", "Boolean", "ID"]);

/**
 * Codegen file for generating Pothos UserSchemaTypes type definitions.
 */

const F = ts.factory;

// Given a GraphQL schema, returns TypeScript code that exports all enums
// as a single object mapping enum names to their TypeScript values.
export function codegenPothosUserSchemaTypes(
  schema: GraphQLSchema,
  config: GratsConfig,
): string {
  const astBuilder = new TSAstBuilder(
    config.EXPERIMENTAL__emitPothos!,
    config.importModuleSpecifierEnding,
  );
  const codegen = new PothosCodegen(schema, config, astBuilder);
  codegen.generate();
  return astBuilder.print();
}

class PothosCodegen {
  constructor(
    private schema: GraphQLSchema,
    private config: GratsConfig,
    private ts: TSAstBuilder,
  ) {}

  generate() {
    this.generatePothosUserSchemaTypes();
  }

  private generatePothosUserSchemaTypes(): void {
    const objects: ts.TypeElement[] = [];
    const inputs: ts.TypeElement[] = [];
    const enums: ts.TypeElement[] = [];
    const interfaces: ts.TypeElement[] = [];
    const scalars: ts.TypeElement[] = [];
    const unions: ts.TypeElement[] = [];
    for (const [name, type] of Object.entries(this.schema.getTypeMap())) {
      if (name.startsWith("__") || BUILT_IN_SCALARS.has(name)) continue;

      // Ensure we have an AST node; preserve original behavior of throwing if absent
      const ast = nullThrows(type.astNode);
      const exported = ast.exported;
      if (exported == null) continue;

      // Handle scalars specially because they map to a small type literal (Input/Output)
      if (type instanceof GraphQLScalarType) {
        const localName = `${name}Internal`;
        this.ts.importUserConstruct(exported, localName, false);
        scalars.push(
          F.createPropertySignature(
            undefined,
            name,
            undefined,
            F.createTypeLiteralNode([
              F.createPropertySignature(
                undefined,
                "Output",
                undefined,
                F.createTypeReferenceNode(localName, undefined),
              ),
              F.createPropertySignature(
                undefined,
                "Input",
                undefined,
                F.createTypeReferenceNode(localName, undefined),
              ),
            ]),
          ),
        );
        continue;
      }

      // For all other named types we delegate to typeProperty and add to the
      // correct collection based on runtime class.
      const prop = this.typeProperty(name, exported);
      if (type instanceof GraphQLObjectType) objects.push(prop);
      else if (type instanceof GraphQLInputObjectType) inputs.push(prop);
      else if (type instanceof GraphQLEnumType) enums.push(prop);
      else if (type instanceof GraphQLInterfaceType) interfaces.push(prop);
      else if (type instanceof GraphQLUnionType) unions.push(prop);
    }

    const maybeProperties: Array<ts.PropertySignature | undefined> = [
      F.createPropertySignature(
        undefined,
        "Defaults",
        undefined,
        F.createLiteralTypeNode(F.createStringLiteral("v4")),
      ),
      this.property("Objects", objects),
      this.property("Inputs", inputs),
      this.property("Interface", interfaces),
      this.property("Unions", unions),
      this.property("Scalars", scalars),
      this.property("Enums", enums),
      F.createPropertySignature(
        undefined,
        "DefaultFieldNullability",
        undefined,
        F.createLiteralTypeNode(this.ts.boolean(this.config.nullableByDefault)),
      ),
    ];

    this.ts.addStatement(
      F.createTypeAliasDeclaration(
        [F.createModifier(ts.SyntaxKind.ExportKeyword)],
        "PothosUserSchemaTypes",
        undefined,
        F.createTypeLiteralNode(maybeProperties.filter((p) => p != null)),
      ),
    );
  }

  typeProperty(name: string, exported: ExportDefinition): ts.PropertySignature {
    const localName = `${name}Internal`;
    this.ts.importUserConstruct(exported, localName, false);
    return F.createPropertySignature(
      undefined,
      name,
      undefined,
      F.createTypeReferenceNode(localName, undefined),
    );
  }

  property(name: string, members: ts.TypeElement[]) {
    if (members.length === 0) {
      return undefined;
    }
    return F.createPropertySignature(
      undefined,
      name,
      undefined,
      F.createTypeLiteralNode(members),
    );
  }
}
