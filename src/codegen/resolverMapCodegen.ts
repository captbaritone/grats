import * as ts from "typescript";
import { GratsConfig } from "../gratsConfig";
import TSAstBuilder from "./TSAstBuilder";
import ResolverCodegen from "./resolverCodegen";
import { ResolverDefinition, Resolvers } from "../resolverSchema";
import { GraphQLObjectType, GraphQLSchema } from "graphql";

const F = ts.factory;

/**
 * Codegen for a GraphQL Tools style resolver map.
 * https://the-guild.dev/graphql/tools/docs/resolvers#resolver-map
 */
export function resolverMapCodegen(
  schema: GraphQLSchema,
  resolvers: Resolvers,
  config: GratsConfig,
  destination: string,
): string {
  const codegen = new Codegen(schema, resolvers, config, destination);

  codegen.resolverMapExport();

  return codegen.ts.print();
}

class Codegen {
  ts: TSAstBuilder;
  resolvers: ResolverCodegen;

  constructor(
    public _schema: GraphQLSchema,
    public _resolvers: Resolvers,
    config: GratsConfig,
    destination: string,
  ) {
    this.ts = new TSAstBuilder(destination, config.importModuleSpecifierEnding);
    this.resolvers = new ResolverCodegen(this.ts, _resolvers);
  }

  resolverMapExport(): void {
    this.ts.import("@graphql-tools/utils", [{ name: "IResolvers" }]);
    this.ts.functionDeclaration(
      "getResolverMap",
      [F.createModifier(ts.SyntaxKind.ExportKeyword)],
      F.createTypeReferenceNode("IResolvers"),
      this.ts.createBlockWithScope(() => {
        this.ts.addStatement(F.createReturnStatement(this.resolverMap()));
      }),
    );
  }

  resolverMap(): ts.ObjectLiteralExpression {
    return this.ts.objectLiteral(this.types());
  }

  types(): ts.ObjectLiteralElementLike[] {
    const types: ts.ObjectLiteralElementLike[] = [];
    for (const [typeName, resolvers] of Object.entries(this._resolvers.types)) {
      const resolverMethods = this.resolversMethods(typeName, resolvers);
      if (resolverMethods.length > 0) {
        types.push(
          F.createPropertyAssignment(
            typeName,
            this.ts.objectLiteral(resolverMethods),
          ),
        );
      }
    }
    return types;
  }

  resolversMethods(
    typeName: string,
    signatures: Record<string, ResolverDefinition>,
  ): ts.ObjectLiteralElementLike[] {
    const graphQLType = this._schema.getType(typeName);
    if (!(graphQLType instanceof GraphQLObjectType)) {
      throw new Error(`Type ${typeName} is not an object type`);
    }
    const fields: ts.ObjectLiteralElementLike[] = [];
    for (const fieldName of Object.keys(signatures)) {
      const method = this.resolvers.resolveMethod(
        fieldName,
        fieldName,
        typeName,
      );
      const wrapped = this.resolvers.maybeApplySemanticNullRuntimeCheck(
        graphQLType.getFields()[fieldName],
        method,
        fieldName,
      );
      if (wrapped != null) {
        fields.push(wrapped);
      }
    }

    return fields;
  }
}
