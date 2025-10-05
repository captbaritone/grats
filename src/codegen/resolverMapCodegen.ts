import * as ts from "typescript";
import { GratsConfig } from "../gratsConfig";
import TSAstBuilder from "./TSAstBuilder";
import ResolverCodegen from "./resolverCodegen";
import { Metadata, FieldDefinition } from "../metadata";
import { GraphQLObjectType, GraphQLSchema } from "graphql";
import { nullThrows } from "../utils/helpers";

const F = ts.factory;

/**
 * EXPERIMENTAL!
 *
 * Codegen for a GraphQL Tools style resolver map. This is an alternative to
 * generating a GraphQLSchema directly. This is mostly provided as an example
 * and the goal is that eventually it should be possible to generate this output
 * in userland.
 *
 * https://the-guild.dev/graphql/tools/docs/resolvers#resolver-map
 */
export function resolverMapCodegen(
  schema: GraphQLSchema,
  resolvers: Metadata,
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
    public _resolvers: Metadata,
    config: GratsConfig,
    destination: string,
  ) {
    this.ts = new TSAstBuilder(destination, config.importModuleSpecifierEnding);
    this.resolvers = new ResolverCodegen(this.ts, _resolvers);
  }

  resolverMapExport(): void {
    // I'm not crazy about this. One of Grats' design goals is to be as tightly
    // coupled to just TypeScript and GraphQL JS. Ideally we would not do
    // _anything_ coupled to other libraries but instead provide a way for users
    // to do this themselves.
    this.ts.import("@graphql-tools/utils", [
      { name: "IResolvers", isTypeOnly: true },
    ]);
    this.ts.functionDeclaration(
      "getResolverMap",
      [F.createModifier(ts.SyntaxKind.ExportKeyword)],
      [],
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
    for (const [typeName, fields] of Object.entries(this._resolvers.types)) {
      const resolverMethods = this.resolversMethods(typeName, fields);
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
    fieldDefinitions: Record<string, FieldDefinition>,
  ): ts.ObjectLiteralElementLike[] {
    const graphQLType = this._schema.getType(typeName);
    if (!(graphQLType instanceof GraphQLObjectType)) {
      throw new Error(`Type ${typeName} is not an object type`);
    }
    const fields: ts.ObjectLiteralElementLike[] = [];
    for (const fieldName of Object.keys(fieldDefinitions)) {
      const method = this.resolvers.resolveMethod(
        fieldName,
        fieldName,
        typeName,
        nullThrows(graphQLType.astNode).exported || null,
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
