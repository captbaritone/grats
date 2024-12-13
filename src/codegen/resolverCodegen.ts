import { ConstDirectiveNode, GraphQLField } from "graphql";
import * as ts from "typescript";
import { SEMANTIC_NON_NULL_DIRECTIVE } from "../publicDirectives";
import {
  ASSERT_NON_NULL_HELPER,
  createAssertNonNullHelper,
} from "../codegenHelpers";
import { nullThrows } from "../utils/helpers";
import { ResolverArgument, ResolverDefinition, Metadata } from "../metadata";
import TSAstBuilder from "./TSAstBuilder";

const RESOLVER_ARGS: string[] = ["source", "args", "context", "info"];

const F = ts.factory;

/**
 * Codegen specifically for generating resolver methods for a given field.
 * Having this separate from the other codegen classes allows it to be used
 * for any codegen that needs to generate resolver methods.
 */
export default class ResolverCodegen {
  _helpers: Set<string> = new Set();
  constructor(public ts: TSAstBuilder, public _resolvers: Metadata) {}
  resolveMethod(
    fieldName: string,
    methodName: string,
    parentTypeName: string,
  ): ts.MethodDeclaration | null {
    const { resolver } = this._resolvers.types[parentTypeName][fieldName];
    if (this.isDefaultResolverSignature(fieldName, resolver)) {
      return null;
    }
    switch (resolver.kind) {
      case "property":
        return this.ts.method(
          methodName,
          [this.ts.param("source")],
          [
            F.createReturnStatement(
              F.createPropertyAccessExpression(
                F.createIdentifier("source"),
                F.createIdentifier(resolver.name ?? fieldName),
              ),
            ),
          ],
        );
      case "method": {
        return this.ts.method(
          methodName,
          extractUsedParams(resolver.arguments ?? [], true).map((name) =>
            this.ts.param(name),
          ),
          [
            F.createReturnStatement(
              F.createCallExpression(
                F.createPropertyAccessExpression(
                  F.createIdentifier("source"),
                  F.createIdentifier(resolver.name ?? fieldName),
                ),
                [],
                (resolver.arguments ?? []).map((arg) => {
                  return this.resolverParam(arg);
                }),
              ),
            ),
          ],
        );
      }
      case "function": {
        const resolverName = formatResolverFunctionVarName(
          parentTypeName,
          fieldName,
        );
        this.ts.importUserConstruct(
          resolver.path,
          resolver.exportName,
          resolverName,
        );
        return this.ts.method(
          methodName,
          extractUsedParams(resolver.arguments ?? [], true).map((name) =>
            this.ts.param(name),
          ),
          [
            F.createReturnStatement(
              F.createCallExpression(
                F.createIdentifier(resolverName),
                undefined,
                (resolver.arguments ?? []).map((arg) => {
                  return this.resolverParam(arg);
                }),
              ),
            ),
          ],
        );
      }
      case "staticMethod": {
        // Note: This name is guaranteed to be unique, but for static methods, it
        // means we import the same class multiple times with multiple names.
        const resolverName = formatResolverFunctionVarName(
          parentTypeName,
          fieldName,
        );
        this.ts.importUserConstruct(
          resolver.path,
          resolver.exportName,
          resolverName,
        );
        return this.ts.method(
          methodName,
          extractUsedParams(resolver.arguments ?? [], true).map((name) =>
            this.ts.param(name),
          ),
          [
            F.createReturnStatement(
              F.createCallExpression(
                F.createPropertyAccessExpression(
                  F.createIdentifier(resolverName),
                  F.createIdentifier(resolver.name),
                ),
                undefined,
                (resolver.arguments ?? []).map((arg) => {
                  return this.resolverParam(arg);
                }),
              ),
            ),
          ],
        );
      }
      default:
        // @ts-expect-error
        throw new Error(`Unexpected resolver kind ${fieldDefinition.kind}`);
    }
  }
  isDefaultResolverSignature(
    fieldName: string,
    signature: ResolverDefinition,
  ): boolean {
    switch (signature.kind) {
      case "property":
        return signature.name == null || fieldName === signature.name;
      case "method":
        if (signature.name != null && fieldName !== signature.name) {
          return false;
        }
        if (signature.arguments == null || signature.arguments.length === 0) {
          return true;
        }
        return signature.arguments.every((arg, i) => {
          switch (i) {
            case 0:
              return arg.kind === "argumentsObject";
            // TODO: More?
            default:
              return false;
          }
        });
      case "function":
        return false;
      case "staticMethod":
        return false;
    }
  }
  // Either `args`, `context`, `info`, or a positional argument like
  // `args.someArg`.
  resolverParam(arg: ResolverArgument): ts.Expression {
    switch (arg.kind) {
      case "argumentsObject":
        return F.createIdentifier("args");
      case "context":
        return F.createIdentifier("context");
      case "information":
        return F.createIdentifier("info");
      case "source":
        return F.createIdentifier("source");
      case "named":
        return F.createPropertyAccessExpression(
          F.createIdentifier("args"),
          F.createIdentifier(arg.name),
        );
      case "derivedContext": {
        const localName = "derivedContext";
        this.ts.importUserConstruct(arg.path, arg.exportName, localName);
        return F.createCallExpression(
          F.createIdentifier(localName),
          undefined,
          [this.resolverParam(arg.input)],
        );
      }

      default:
        // @ts-expect-error
        throw new Error(`Unexpected resolver kind ${arg.kind}`);
    }
  }
  // If a field is smantically non-null, we need to wrap the resolver in a
  // runtime check to ensure that the resolver does not return null.
  maybeApplySemanticNullRuntimeCheck(
    field: GraphQLField<unknown, unknown>,
    method_: ts.MethodDeclaration | null,
    methodName: string,
  ): ts.MethodDeclaration | null {
    const semanticNonNull = fieldDirective(field, SEMANTIC_NON_NULL_DIRECTIVE);
    if (semanticNonNull == null) {
      return method_;
    }

    if (!this._helpers.has(ASSERT_NON_NULL_HELPER)) {
      this._helpers.add(ASSERT_NON_NULL_HELPER);
      this.ts.addHelper(createAssertNonNullHelper());
    }

    const method = method_ ?? this.defaultResolverMethod(methodName);

    const bodyStatements = method.body?.statements;
    if (bodyStatements == null || bodyStatements.length === 0) {
      throw new Error(`Expected method to have a body`);
    }
    let foundReturn = false;
    const newBodyStatements = bodyStatements.map((statement) => {
      if (ts.isReturnStatement(statement)) {
        foundReturn = true;
        // We need to wrap the return statement in a call to the runtime check
        return F.createReturnStatement(
          F.createCallExpression(
            F.createIdentifier(ASSERT_NON_NULL_HELPER),
            [],
            [nullThrows(statement.expression)],
          ),
        );
      }
      return statement;
    });
    if (!foundReturn) {
      throw new Error(`Expected method to have a return statement`);
    }
    return { ...method, body: F.createBlock(newBodyStatements, true) };
  }

  defaultResolverMethod(methodName: string): ts.MethodDeclaration {
    this.ts.import("graphql", [{ name: "defaultFieldResolver" }]);
    return this.ts.method(
      methodName,
      RESOLVER_ARGS.map((name) => this.ts.param(name)),
      [
        F.createReturnStatement(
          F.createCallExpression(
            F.createIdentifier("defaultFieldResolver"),
            undefined,
            RESOLVER_ARGS.map((name) => F.createIdentifier(name)),
          ),
        ),
      ],
    );
  }
}

// Here we try to avoid including unused args.
//
// Unused trailing args are trimmed, unused intermediate args are prefixed with
// an underscore.
function extractUsedParams(
  resolverParams: ResolverArgument[],
  includeSource: boolean = false,
): string[] {
  const wrapperArgs: string[] = [];

  let adding = false;
  for (let i = RESOLVER_ARGS.length - 1; i >= 0; i--) {
    const name = RESOLVER_ARGS[i];
    const used =
      resolverParams.some((param) => {
        return (
          (param.kind === "named" && name === "args") ||
          (param.kind === "argumentsObject" && name === "args") ||
          (param.kind === "context" && name === "context") ||
          (param.kind === "information" && name === "info") ||
          (param.kind === "source" && name === "source")
        );
      }) ||
      (name === "source" && includeSource);

    if (used) {
      adding = true;
    }
    if (!adding) {
      continue;
    }

    wrapperArgs.unshift(used ? name : `_${name}`);
  }
  return wrapperArgs;
}

function fieldDirective(
  field: GraphQLField<unknown, unknown>,
  name: string,
): ConstDirectiveNode | null {
  return field.astNode?.directives?.find((d) => d.name.value === name) ?? null;
}

function formatResolverFunctionVarName(
  parentTypeName: string,
  fieldName: string,
): string {
  const parent = parentTypeName[0].toLowerCase() + parentTypeName.slice(1);
  const field = fieldName[0].toUpperCase() + fieldName.slice(1);
  return `${parent}${field}Resolver`;
}
