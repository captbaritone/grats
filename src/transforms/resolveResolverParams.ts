import * as ts from "typescript";
import {
  DefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  Kind,
  visit,
} from "graphql";
import {
  DerivedResolverDefinition,
  TypeContext,
  UNRESOLVED_REFERENCE_NAME,
} from "../TypeContext";
import { err, ok } from "../utils/Result";
import {
  DiagnosticsResult,
  FixableDiagnosticWithLocation,
  gqlErr,
  tsErr,
  tsRelated,
} from "../utils/DiagnosticError";
import { invariant, nullThrows } from "../utils/helpers";
import {
  ContextResolverArgument,
  DerivedContextResolverArgument,
  NamedResolverArgument,
  ResolverArgument,
  UnresolvedResolverArgument,
} from "../resolverSignature";
import * as E from "../Errors";
import { GraphQLConstructor } from "../GraphQLConstructor";

export function resolveResolverParams(
  ctx: TypeContext,
  definitions: Array<DefinitionNode>,
): DiagnosticsResult<DefinitionNode[]> {
  const resolver = new ResolverParamsResolver(ctx);
  return resolver.resolve(definitions);
}

class ResolverParamsResolver {
  ctx: TypeContext;
  gql: GraphQLConstructor;
  errors: FixableDiagnosticWithLocation[] = [];
  constructor(ctx: TypeContext) {
    this.ctx = ctx;
    this.gql = new GraphQLConstructor();
  }

  resolve(
    definitions: Array<DefinitionNode>,
  ): DiagnosticsResult<DefinitionNode[]> {
    const nextDefinitions = definitions.map((def) => {
      return visit(def, {
        [Kind.FIELD_DEFINITION]: (field) => this.transformField(field),
      });
    });

    if (this.errors.length > 0) {
      return err(this.errors);
    }
    return ok(nextDefinitions);
  }

  private transformField(field: FieldDefinitionNode): FieldDefinitionNode {
    const resolver = nullThrows(field.resolver);

    if (resolver.kind === "property" || resolver.arguments == null) {
      return field;
    }

    // Resolve all the params individually
    const resolverParams: ResolverArgument[] = [];
    for (const param of resolver.arguments) {
      const transformed = this.transformParam(param);
      if (transformed == null) return field;
      resolverParams.push(transformed);
    }

    // Now we check to see if the params are a valid combination...
    const args = resolverParams.find(
      (param) => param.kind === "argumentsObject",
    );
    const positionalArgs: NamedResolverArgument[] = resolverParams.filter(
      (param) => param.kind === "named",
    );

    if (args != null && positionalArgs.length > 0) {
      this.errors.push(
        tsErr(nullThrows(args.node), E.positionalArgAndArgsObject(), [
          tsRelated(
            positionalArgs[0].node,
            "Positional GraphQL argument defined here",
          ),
        ]),
      );
      return field;
    }

    const fieldArgs: InputValueDefinitionNode[] =
      field.arguments == null ? [] : [...field.arguments];

    // Add any positional args to the field's arguments
    for (const positionalArg of positionalArgs) {
      fieldArgs.push(positionalArg.inputDefinition);
    }

    const newResolver = {
      ...resolver,
      arguments: resolverParams,
    };

    return { ...field, arguments: fieldArgs, resolver: newResolver };
  }

  transformParam(
    param: ResolverArgument,
    seenDerivedContextValues?: Map<string, ts.Node>,
  ): ResolverArgument | null {
    switch (param.kind) {
      case "named":
      case "argumentsObject":
      case "information":
      case "context":
      case "derivedContext":
      case "source":
        return param;
      case "unresolved": {
        const unwrappedType = this.gql.nullableType(param.inputDefinition.type);
        if (
          unwrappedType.kind === "NamedType" &&
          unwrappedType.name.value === UNRESOLVED_REFERENCE_NAME
        ) {
          const resolved = this.ctx.gqlNameDefinitionForGqlName(
            unwrappedType.name,
          );
          if (resolved.kind === "ERROR") {
            this.errors.push(resolved.err);
            return null;
          }
          switch (resolved.value.kind) {
            case "DERIVED_CONTEXT": {
              const derivedContextArg = this.resolveDerivedContext(
                param.node,
                resolved.value,
                seenDerivedContextValues,
              );
              if (derivedContextArg === null) return null;
              return derivedContextArg;
            }
            case "CONTEXT":
              return { kind: "context", node: param.node };
            case "INFO":
              return { kind: "information", node: param.node };
            default: {
              // We'll assume it's supposed to be a positional arg.
              return this.resolveToPositionalArg(param) ?? param;
            }
          }
        }
        // This can't be a context or info param so we'll assume it's supposed
        // to be a positional arg.
        return this.resolveToPositionalArg(param) ?? param;
      }
      default: {
        // @ts-expect-error
        throw new Error(`Unexpected param kind ${param.kind}`);
      }
    }
  }

  private resolveDerivedContext(
    node: ts.Node, // Argument
    definition: DerivedResolverDefinition,
    seenDerivedContextValues?: Map<string, ts.Node>,
  ): ResolverArgument | null {
    const { path, exportName, args } = definition;
    const key = `${path}:${exportName}`;
    if (seenDerivedContextValues == null) {
      // We're resolving the arg of a resolver. Initiate the map.
      seenDerivedContextValues = new Map();
    } else {
      if (seenDerivedContextValues.has(key)) {
        this.errors.push(
          this.cycleError(node, definition, seenDerivedContextValues),
        );
        return null;
      }
    }
    seenDerivedContextValues.set(key, node);

    const newArgs: Array<
      DerivedContextResolverArgument | ContextResolverArgument
    > = [];
    for (const arg of args) {
      const resolvedArg = this.transformParam(arg, seenDerivedContextValues);
      if (resolvedArg === null) {
        continue;
      }
      switch (resolvedArg.kind) {
        case "context":
          newArgs.push(resolvedArg);
          break;
        case "derivedContext":
          // Here we know that the argument `node` maps to a derived context
          // `definition` which itself depends another derived resolver `resolvedArg`.
          // `definition`.
          newArgs.push(resolvedArg);
          break;
        default:
          this.errors.push(
            tsErr(resolvedArg.node, E.invalidDerivedContextArgType()),
          );
      }
    }
    return { kind: "derivedContext", node, path, exportName, args: newArgs };
  }

  resolveToPositionalArg(
    unresolved: UnresolvedResolverArgument,
  ): ResolverArgument | null {
    if (unresolved.inputDefinition.name.kind === "ERROR") {
      this.errors.push(unresolved.inputDefinition.name.err);
      return null;
    }
    return {
      kind: "named",
      name: unresolved.inputDefinition.name.value.value,
      inputDefinition: {
        ...unresolved.inputDefinition,
        name: unresolved.inputDefinition.name.value,
      },
      node: unresolved.node,
    };
  }

  /**
   * Some slightly complicated logic to construct nice errors in the case of
   * cycles where derived resolvers ultimately depend upon themselves.
   *
   * The `@gqlContext` tag is the main location. If it's a direct cycle, we
   * report one related location, of the argument which points back to itself.
   *
   * If there are multiple nodes in the cycle, we report a related location for
   * each node in the cycle, with a message that depends on the position of the
   * node in the cycle.
   */
  cycleError(
    node: ts.Node,
    definition: DerivedResolverDefinition,
    seenDerivedContextValues: Map<string, ts.Node>,
  ): ts.DiagnosticWithLocation {
    // We trim off the first node because that points to a resolver argument.
    const nodes = Array.from(seenDerivedContextValues.values()).slice(1);
    // The cycle completes with this node, so we include it in the list.
    nodes.push(node);
    const related = nodes.map((def, i) => {
      if (nodes.length === 1) {
        return tsRelated(def, "This derived context depends on itself");
      }

      const isFirst = i === 0;
      const isLast = i === nodes.length - 1;

      invariant(!(isFirst && isLast), "Should not be both first and last");

      if (isFirst) {
        return tsRelated(def, "This derived context depends on");
      } else if (!isLast) {
        return tsRelated(def, "Which in turn depends on");
      }
      return tsRelated(
        def,
        "Which ultimately creates a cycle back to the initial derived context",
      );
    });
    return gqlErr(definition.name, E.cyclicDerivedContext(), related);
  }
}
