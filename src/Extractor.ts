import {
  FieldDefinitionNode,
  InputValueDefinitionNode,
  Kind,
  NamedTypeNode,
  NameNode,
  TypeNode,
  StringValueNode,
  ConstValueNode,
  ConstDirectiveNode,
  ConstArgumentNode,
  EnumValueDefinitionNode,
  ConstObjectFieldNode,
  ConstObjectValueNode,
  ConstListValueNode,
  assertName,
  DefinitionNode,
  version as graphqlJSVersion,
  TokenKind,
  GraphQLError,
} from "graphql";
import { gte as semverGte } from "semver";
import {
  tsErr,
  tsRelated,
  DiagnosticsResult,
  gqlErr,
  DiagnosticResult,
} from "./utils/DiagnosticError";
import { err, ok } from "./utils/Result";
import * as ts from "typescript";
import {
  DeclarationDefinition,
  NameDefinition,
  UNRESOLVED_REFERENCE_NAME,
} from "./TypeContext";
import * as E from "./Errors";
import { traverseJSDocTags } from "./utils/JSDoc";
import { GraphQLConstructor, loc } from "./GraphQLConstructor";
import { relativePath } from "./gratsRoot";
import { ISSUE_URL } from "./Errors";
import { detectInvalidComments } from "./comments";
import {
  bestMatch,
  extend,
  invariant,
  levenshteinDistance,
  TsIdentifier,
} from "./utils/helpers";
import * as Act from "./CodeActions";
import {
  InputValueDefinitionNodeOrResolverArg,
  ResolverArgument,
} from "./resolverSignature";
import { Parser } from "graphql/language/parser";
import { ExportDefinition } from "./GraphQLAstExtensions";

export const LIBRARY_IMPORT_NAME = "grats";
export const LIBRARY_NAME = "Grats";

export const TYPE_TAG = "gqlType";
export const FIELD_TAG = "gqlField";
export const SCALAR_TAG = "gqlScalar";
export const INTERFACE_TAG = "gqlInterface";
export const ENUM_TAG = "gqlEnum";
export const UNION_TAG = "gqlUnion";
export const INPUT_TAG = "gqlInput";
export const DIRECTIVE_TAG = "gqlDirective";
export const ANNOTATE_TAG = "gqlAnnotate";

export const QUERY_FIELD_TAG = "gqlQueryField";
export const MUTATION_FIELD_TAG = "gqlMutationField";
export const SUBSCRIPTION_FIELD_TAG = "gqlSubscriptionField";

export const CONTEXT_TAG = "gqlContext";
export const INFO_TAG = "gqlInfo";

export const IMPLEMENTS_TAG_DEPRECATED = "gqlImplements";
export const KILLS_PARENT_ON_EXCEPTION_TAG = "killsParentOnException";

// All the tags that start with gql
export const ALL_GQL_TAGS = [
  TYPE_TAG,
  FIELD_TAG,
  SCALAR_TAG,
  INTERFACE_TAG,
  ENUM_TAG,
  UNION_TAG,
  INPUT_TAG,
  DIRECTIVE_TAG,
  ANNOTATE_TAG,
  QUERY_FIELD_TAG,
  MUTATION_FIELD_TAG,
  SUBSCRIPTION_FIELD_TAG,
] as const;

const DEPRECATED_TAG = "deprecated";
export const ONE_OF_TAG = "oneOf";

export const TAGS = [
  ...ALL_GQL_TAGS,
  KILLS_PARENT_ON_EXCEPTION_TAG,
  ONE_OF_TAG,
] as const;

export type TagName = (typeof TAGS)[number];

// https://github.com/graphql/graphql-js/releases/tag/v16.9.0
const ONE_OF_MIN_GRAPHQL_JS_VERSION = "16.9.0";
export const OPERATION_TYPES = new Set(["Query", "Mutation", "Subscription"]);

type ArgDefaults = Map<string, ts.Expression>;

export type ExtractionSnapshot = {
  /** GraphQL definitions extracted from the TypeScript source file. */
  readonly definitions: DefinitionNode[];

  /**
   * Map from a TypeScript AST node that may reference a GraphQL type to a
   * GraphQL NameNode. Note that at extraction time we don't actually know the
   * GraphQL name that this references, or if it even references a valid Grats
   * type. So, the `NameNode` passed here will generally have a placeholder
   * name. This will be resolved in a later pass since it may reference a type
   * defined in another file and extraction is done on a per-file basis.
   */
  readonly unresolvedNames: Map<TsIdentifier, ts.EntityName>;

  /** Map from a TypeScript declaration to the extracted GraphQL name and kind. */
  readonly nameDefinitions: Map<ts.DeclarationStatement, NameDefinition>;

  /**
   * Some declarations (notably derived context functions) are not actually the
   * declaration that will become a special GraphQL value, but rather they
   * _reference_ a type which will implicitly become a special type to Grats.
   */
  readonly implicitNameDefinitions: Map<
    DeclarationDefinition,
    ts.TypeReferenceNode
  >;

  /**
   * Records which named GraphQL types define a `__typename` field.
   * This is used to ensure all types which are members of an abstract type
   * (union or interface) define a `__typename` field which is required to
   * determine their GraphQL type at runtime.
   */
  readonly typesWithTypename: Set<string>;

  /**
   * TypeScript interfaces which have been used to define GraphQL types. This is
   * used in a later validation pass to ensure we never use merged interfaces,
   * since merged interfaces have surprising behaviors which can lead to bugs.
   */
  readonly interfaceDeclarations: Array<ts.InterfaceDeclaration>;
};

type FieldTypeContext = {
  kind: "OUTPUT" | "INPUT";
};

/**
 * Extracts GraphQL definitions from TypeScript source code.
 *
 * Note that we extract a GraphQL AST with the AST nodes' location information
 * populated with references to the TypeScript code from which the types were
 * derived.
 *
 * This ensures that we can apply GraphQL schema validation rules, and any reported
 * errors will point to the correct location in the TypeScript source code.
 */
export function extract(
  sourceFile: ts.SourceFile,
  config?: { tsClientEnums?: string | null },
): DiagnosticsResult<ExtractionSnapshot> {
  const extractor = new Extractor(config);
  return extractor.extract(sourceFile);
}

class Extractor {
  // Snapshot data. See comments on fields on ExtractionSnapshot for details.
  definitions: DefinitionNode[] = [];
  unresolvedNames: Map<TsIdentifier, ts.EntityName> = new Map();
  nameDefinitions: Map<ts.DeclarationStatement, NameDefinition> = new Map();
  implicitNameDefinitions: Map<DeclarationDefinition, ts.TypeReferenceNode> =
    new Map();
  typesWithTypename: Set<string> = new Set();
  interfaceDeclarations: Array<ts.InterfaceDeclaration> = [];

  errors: ts.DiagnosticWithLocation[] = [];
  gql: GraphQLConstructor;
  config?: { tsClientEnums?: string | null };

  constructor(config?: { tsClientEnums?: string | null }) {
    this.gql = new GraphQLConstructor();
    this.config = config;
  }

  markUnresolvedType(node: ts.EntityName, name: NameNode) {
    this.unresolvedNames.set(name.tsIdentifier, node);
  }

  recordTypeName(
    node: ts.DeclarationStatement,
    name: NameNode,
    kind: NameDefinition["kind"],
  ): void {
    this.nameDefinitions.set(node, { name, kind });
  }

  // Traverse all nodes, checking each one for its JSDoc tags.
  // If we find a tag we recognize, we extract the relevant information,
  // reporting an error if it is attached to a node where that tag is not
  // supported.
  extract(sourceFile: ts.SourceFile): DiagnosticsResult<ExtractionSnapshot> {
    const seenCommentPositions: Set<number> = new Set();
    traverseJSDocTags(sourceFile, (node, tag) => {
      seenCommentPositions.add(tag.parent.pos);
      switch (tag.tagName.text) {
        case DIRECTIVE_TAG:
          this.extractDirective(node, tag);
          break;
        case TYPE_TAG:
          this.extractType(node, tag);
          break;
        case SCALAR_TAG:
          this.extractScalar(node, tag);
          break;
        case INTERFACE_TAG:
          this.extractInterface(node, tag);
          break;
        case ENUM_TAG:
          this.extractEnum(node, tag);
          break;
        case INPUT_TAG: {
          const oneOf = this.findTag(node, ONE_OF_TAG);
          if (oneOf != null) {
            this.report(
              oneOf,
              "The `@oneOf` tag has been deprecated. Grats will now automatically add the `@oneOf` directive if you define your input type as a TypeScript union. You can remove the `@oneOf` tag.",
              [],
              {
                fixName: "remove-oneOf-tag",
                description: "Remove @oneOf tag",
                changes: [Act.removeNode(oneOf)],
              },
            );
          } else {
            this.extractInput(node, tag);
          }
          break;
        }
        case UNION_TAG:
          this.extractUnion(node, tag);
          break;
        case QUERY_FIELD_TAG:
          this.extractField(node, tag, "Query");
          break;
        case MUTATION_FIELD_TAG:
          this.extractField(node, tag, "Mutation");
          break;
        case SUBSCRIPTION_FIELD_TAG:
          this.extractField(node, tag, "Subscription");
          break;
        case FIELD_TAG:
          this.extractField(node, tag, null);
          break;
        case CONTEXT_TAG: {
          if (!ts.isDeclarationStatement(node)) {
            this.report(tag, E.contextTagOnNonDeclaration());
          } else {
            if (ts.isFunctionDeclaration(node)) {
              this.recordDerivedContext(node, tag);
            } else {
              const name = this.gql.name(tag, "CONTEXT_DUMMY_NAME");
              this.recordTypeName(node, name, "CONTEXT");
            }
          }
          break;
        }
        case INFO_TAG: {
          if (!ts.isTypeAliasDeclaration(node)) {
            this.report(tag, E.userDefinedInfoTag());
          } else {
            const name = this.gql.name(tag, "INFO_DUMMY_NAME");
            this.recordTypeName(node, name, "INFO");
          }
          break;
        }
        case KILLS_PARENT_ON_EXCEPTION_TAG: {
          if (
            !(
              this.hasTag(node, FIELD_TAG) ||
              this.hasTag(node, QUERY_FIELD_TAG) ||
              this.hasTag(node, MUTATION_FIELD_TAG) ||
              this.hasTag(node, SUBSCRIPTION_FIELD_TAG)
            )
          ) {
            this.report(tag.tagName, E.killsParentOnExceptionOnWrongNode(), []);
          }
          // TODO: Report invalid location as well
          break;
        }
        case ANNOTATE_TAG: {
          // Because we can annotate directives, and directives don't have
          // any other `@gql` tags, we can't effectively check for unused
          // annotate tags here.

          // TODO: Improve validation of miss-placed `@gqlAnnotate` tags.
          break;
        }
        case "specifiedBy":
          this.report(tag, E.specifiedByDeprecated(), [], {
            fixName: "replace-specifiedBy-with-gqlAnnotate",
            description: "Replace @specifiedBy with @gqlAnnotate",
            changes: [
              Act.replaceNode(
                tag,
                `@gqlAnnotate specifiedBy(url: "${tag.comment}")`,
              ),
            ],
          });
          break;
        default:
          {
            const lowerCaseTag = tag.tagName.text.toLowerCase();
            if (lowerCaseTag.startsWith("gql")) {
              let reported = false;
              if (tag.tagName.text === IMPLEMENTS_TAG_DEPRECATED) {
                this.report(tag.tagName, E.implementsTagDeprecated());
                break;
              }
              for (const t of ALL_GQL_TAGS) {
                if (t.toLowerCase() === lowerCaseTag) {
                  this.report(
                    tag.tagName,
                    E.wrongCasingForGratsTag(tag.tagName.text, t),
                    [],
                    {
                      fixName: "fix-grats-tag-casing",
                      description: `Change to @${t}`,
                      changes: [Act.replaceNode(tag.tagName, t)],
                    },
                  );
                  reported = true;
                  break;
                }
              }
              if (!reported) {
                const suggested = bestMatch(
                  ALL_GQL_TAGS,
                  (t) => -levenshteinDistance(t, tag.tagName.text),
                );

                this.report(
                  tag.tagName,
                  E.invalidGratsTag(tag.tagName.text),
                  [],
                  {
                    fixName: `change-to-${suggested}`,
                    description: `Change to @${suggested}`,
                    changes: [Act.replaceNode(tag.tagName, suggested)],
                  },
                );
              }
            }
          }
          break;
      }
    });
    const errors = detectInvalidComments(sourceFile, seenCommentPositions);
    extend(this.errors, errors);

    if (this.errors.length > 0) {
      return err(this.errors);
    }
    return ok({
      definitions: this.definitions,
      unresolvedNames: this.unresolvedNames,
      nameDefinitions: this.nameDefinitions,
      implicitNameDefinitions: this.implicitNameDefinitions,
      typesWithTypename: this.typesWithTypename,
      interfaceDeclarations: this.interfaceDeclarations,
    });
  }

  private extractField(
    node: ts.Node,
    tag: ts.JSDocTag,
    parentType: string | null,
  ) {
    if (ts.isFunctionDeclaration(node)) {
      this.functionDeclarationExtendType(node, tag, parentType);
    } else if (ts.isVariableStatement(node)) {
      this.variableStatementExtendType(node, tag, parentType);
    } else if (isStaticMethod(node)) {
      this.staticMethodExtendType(node, tag, parentType);
    } else {
      if (parentType != null) {
        this.report(tag, E.rootFieldTagOnWrongNode(parentType));
        return;
      }
      // Non-function fields must be defined as a decent of something that
      // is annotated with @gqlType or @gqlInterface.
      //
      // The actual field will get extracted when we traverse the parent, but
      // we need to report an error if the parent is not a valid type or is not
      // annotated with @gqlType or @gqlInterface. Otherwise, the user may get
      // confused as to why the field is not showing up in the schema.
      const parent = getFieldParent(node);

      // If there was no valid parent, report an error.
      if (parent === null) {
        this.reportUnhandled(node, "field", E.fieldTagOnWrongNode());
      } else if (this.hasTag(parent, INPUT_TAG)) {
        // You don't need to add `@gqlField` to input types, but it's an
        // easy mistake to think you might need to. We report a helpful
        // error in this case and offer a fix.
        const docblock = tag.parent;
        const isOnlyTag =
          ts.isJSDoc(docblock) &&
          docblock.tags?.length === 1 &&
          !docblock.comment;

        const action = isOnlyTag
          ? Act.removeNode(docblock)
          : Act.removeNode(tag);
        this.report(tag, E.gqlFieldTagOnInputType(), [], {
          fixName: "remove-gql-field-from-input",
          description: "Remove @gqlField tag",
          changes: [action],
        });
      } else if (
        !this.hasTag(parent, TYPE_TAG) &&
        !this.hasTag(parent, INTERFACE_TAG)
      ) {
        this.report(tag.tagName, E.gqlFieldParentMissingTag());
      }
    }
  }
  recordDerivedContext(node: ts.FunctionDeclaration, tag: ts.JSDocTag) {
    const returnType = node.type;
    if (returnType == null) {
      return this.report(node, E.missingReturnTypeForDerivedResolver());
    }

    // Check if the return type is Promise<T> and unwrap it
    const unwrapped = this.maybeUnwrapPromiseType(returnType);
    if (unwrapped === null) return null;
    const { type: innerType, isAsync } = unwrapped;

    if (!ts.isTypeReferenceNode(innerType)) {
      return this.report(innerType, E.missingReturnTypeForDerivedResolver());
    }

    const funcName = this.namedFunctionExportName(node);

    if (!ts.isSourceFile(node.parent)) {
      return this.report(node, E.functionFieldNotTopLevel());
    }

    const tsModulePath = relativePath(node.getSourceFile().fileName);

    const paramResults = this.resolverParams(node.parameters);
    if (paramResults == null) return null;

    const name = this.gql.name(tag, "CONTEXT_DUMMY_NAME");
    this.implicitNameDefinitions.set(
      {
        kind: "DERIVED_CONTEXT",
        name,
        path: tsModulePath,
        exportName: funcName?.text ?? null,
        args: paramResults.resolverParams,
        async: isAsync,
      },
      innerType,
    );
  }

  extractDocblockTagComment(
    comment: string | ts.NodeArray<ts.JSDocComment>,
  ): string | null {
    if (typeof comment === "string") {
      return comment;
    }
    let text: string = "";
    let hasErrors = false;
    for (const tag of comment) {
      switch (tag.kind) {
        case ts.SyntaxKind.JSDocText:
          text += tag.getText();
          break;
        default:
          this.report(tag, E.directiveTagCommentNotText());
          hasErrors = true;
      }
    }
    if (hasErrors) return null;
    return text;
  }

  extractDirective(node: ts.Node, tag: ts.JSDocTag) {
    if (!ts.isFunctionDeclaration(node)) {
      return this.report(tag, E.directiveTagOnWrongNode());
    }
    return this.extractDirectiveFunction(node, tag);
  }

  extractDirectiveFunction(node: ts.FunctionDeclaration, tag: ts.JSDocTag) {
    const description = this.collectDescription(node);

    const args = this.extractDirectiveArgs(node);

    if (tag.comment == null) {
      this.report(tag, E.directiveTagNoComment());
      return;
    }
    const comment = this.extractDocblockTagComment(tag.comment);
    if (comment == null) return;

    const tagData = this.parseGql<{
      name: NameNode | null;
      repeatable: boolean;
      locations: NameNode[];
    }>(tag, comment, (parser) => {
      let name: NameNode | null = null;
      let repeatable = parser.expectOptionalKeyword("repeatable");
      const on = parser.expectOptionalKeyword("on");

      // If the first identifier was neither `repeatable` nor `on`, then
      // we expect it to be the directive name.
      if (!on && !repeatable) {
        name = { ...parser.parseName(), loc: loc(tag) };
        repeatable = parser.expectOptionalKeyword("repeatable");
        parser.expectKeyword("on");
      }

      const locations = parser
        .delimitedMany(TokenKind.PIPE, () => parser.parseDirectiveLocation())
        .map((location) => ({ ...location, loc: loc(tag) }));
      return { name, repeatable, locations };
    });

    if (tagData == null) return;

    let name = tagData.name;

    // If there wasn't a name in the directive tag, we expect the function
    // to be named.
    if (name == null) {
      if (node.name == null) {
        return this.report(node, E.directiveFunctionNotNamed());
      }
      const id = this.expectNameIdentifier(node.name);
      if (id == null) return null;
      name = this.gql.name(id, id.text);
    }

    this.definitions.push(
      this.gql.directiveDefinition(
        node,
        name,
        args,
        tagData.repeatable,
        tagData.locations,
        description,
      ),
    );
  }

  extractDirectiveArgs(
    node: ts.FunctionDeclaration,
  ): InputValueDefinitionNode[] | null {
    // Additional arguments are ignored.
    const param: ts.ParameterDeclaration | null = node.parameters[0] ?? null;
    if (param == null) {
      return null;
    }
    if (param.type == null) {
      this.report(param, E.directiveArgumentNotObject());
      return null;
    }
    if (param.type.kind === ts.SyntaxKind.NeverKeyword) {
      return null;
    }
    if (!ts.isTypeLiteralNode(param.type)) {
      this.report(param, E.directiveArgumentNotObject());
      return null;
    }
    let defaults: ArgDefaults | null = null;
    if (ts.isObjectBindingPattern(param.name)) {
      defaults = this.collectArgDefaults(param.name);
    }

    const args: InputValueDefinitionNode[] = [];
    for (const member of param.type.members) {
      const arg = this.collectArg(member, defaults);
      if (arg != null) {
        args.push(arg);
      }
    }
    return args;
  }

  extractType(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isClassDeclaration(node)) {
      this.typeClassDeclaration(node, tag);
    } else if (ts.isInterfaceDeclaration(node)) {
      this.typeInterfaceDeclaration(node, tag);
    } else if (ts.isTypeAliasDeclaration(node)) {
      this.typeTypeAliasDeclaration(node, tag);
    } else {
      this.report(tag, E.invalidTypeTagUsage());
    }
  }

  extractScalar(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isTypeAliasDeclaration(node)) {
      this.scalarTypeAliasDeclaration(node, tag);
    } else {
      this.report(tag, E.invalidScalarTagUsage());
    }
  }

  extractInterface(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isInterfaceDeclaration(node)) {
      this.interfaceInterfaceDeclaration(node, tag);
    } else {
      this.report(tag, E.invalidInterfaceTagUsage());
    }
  }

  extractEnum(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isEnumDeclaration(node)) {
      this.enumEnumDeclaration(node, tag);
    } else if (ts.isTypeAliasDeclaration(node)) {
      this.enumTypeAliasDeclaration(node, tag);
    } else {
      this.report(tag, E.invalidEnumTagUsage());
    }
  }

  extractInput(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isTypeAliasDeclaration(node)) {
      this.inputTypeAliasDeclaration(node, tag);
    } else if (ts.isInterfaceDeclaration(node)) {
      this.inputInterfaceDeclaration(node, tag);
    } else {
      this.report(tag, E.invalidInputTagUsage());
    }
  }

  extractUnion(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isTypeAliasDeclaration(node)) {
      this.unionTypeAliasDeclaration(node, tag);
    } else {
      this.report(tag, E.invalidUnionTagUsage());
    }
  }

  /** Error handling and location juggling */

  report(
    node: ts.Node,
    message: string,
    relatedInformation?: ts.DiagnosticRelatedInformation[],
    fix?: ts.CodeFixAction,
  ): null {
    this.errors.push(tsErr(node, message, relatedInformation, fix));
    return null;
  }

  // Report an error that we don't know how to infer a type, but it's possible that we should.
  // Gives the user a path forward if they think we should be able to infer this type.
  reportUnhandled(
    node: ts.Node,
    positionKind:
      | "type"
      | "field"
      | "field type"
      | "input"
      | "input field"
      | "union member"
      | "constant value"
      | "union"
      | "enum value",
    message: string,
    relatedInformation?: ts.DiagnosticRelatedInformation[],
  ): null {
    const suggestion = `If you think ${LIBRARY_NAME} should be able to infer this ${positionKind}, please report an issue at ${ISSUE_URL}.`;
    const completedMessage = `${message}\n\n${suggestion}`;
    return this.report(node, completedMessage, relatedInformation);
  }

  /** TypeScript traversals */

  unionTypeAliasDeclaration(node: ts.TypeAliasDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    const types: NamedTypeNode[] = [];
    if (ts.isUnionTypeNode(node.type)) {
      for (const member of node.type.types) {
        if (!ts.isTypeReferenceNode(member)) {
          return this.reportUnhandled(
            member,
            "union member",
            E.expectedUnionTypeReference(),
          );
        }
        const namedType = this.gql.namedType(
          member.typeName,
          UNRESOLVED_REFERENCE_NAME,
        );
        this.markUnresolvedType(member.typeName, namedType.name);
        types.push(this.unionMemberDeclaration(member));
      }
    } else if (ts.isTypeReferenceNode(node.type)) {
      types.push(this.unionMemberDeclaration(node.type));
    } else {
      return this.report(node, E.expectedUnionTypeNode());
    }

    const description = this.collectDescription(node);

    this.recordTypeName(node, name, "UNION");

    const directives = this.collectDirectives(node);

    this.definitions.push(
      this.gql.unionTypeDefinition(node, name, types, description, directives),
    );
  }

  unionMemberDeclaration(member: ts.TypeReferenceNode): NamedTypeNode {
    const namedType = this.gql.namedType(
      member.typeName,
      UNRESOLVED_REFERENCE_NAME,
    );
    this.markUnresolvedType(member.typeName, namedType.name);
    return namedType;
  }

  variableStatementExtendType(
    node: ts.VariableStatement,
    tag: ts.JSDocTag,
    parentType: string | null,
  ) {
    if (node.declarationList.declarations.length !== 1) {
      return this.report(
        node,
        E.exportedFieldVariableMultipleDeclarations(
          node.declarationList.declarations.length,
        ),
      );
    }
    const declaration = node.declarationList.declarations[0];

    if (!(node.declarationList.flags & ts.NodeFlags.Const)) {
      // Looks like there's no good way to find the location range of the `let`
      // or `var` keyword.
      return this.report(
        node.declarationList,
        E.exportedArrowFunctionNotConst(),
      );
    }

    const funcName = this.expectNameIdentifier(declaration.name);
    const name = this.entityName(declaration, tag);
    if (name == null) return null;

    if (!ts.isSourceFile(node.parent)) {
      return this.report(node, E.fieldVariableNotTopLevelExported());
    }

    if (
      declaration.initializer == null ||
      !ts.isArrowFunction(declaration.initializer)
    ) {
      return this.report(node, E.fieldVariableIsNotArrowFunction());
    }

    const isExported = node.modifiers?.some((modifier) => {
      return modifier.kind === ts.SyntaxKind.ExportKeyword;
    });

    if (!isExported) {
      return this.report(
        declaration.name,
        E.fieldVariableNotTopLevelExported(),
        [],
        {
          fixName: "add-export-keyword-to-arrow-function",
          description:
            "Add export keyword to exported arrow function with @gqlField",
          changes: [Act.prefixNode(node, "export ")],
        },
      );
    }

    this.collectAbstractField(
      declaration.initializer,
      funcName,
      null,
      name,
      parentType,
    );
  }

  functionDeclarationExtendType(
    node: ts.FunctionDeclaration,
    tag: ts.JSDocTag,
    parentType: string | null,
  ) {
    const funcName = this.namedFunctionExportName(node);
    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (!ts.isSourceFile(node.parent)) {
      return this.report(node, E.functionFieldNotTopLevel());
    }

    this.collectAbstractField(node, funcName, null, name, parentType);
  }

  staticMethodExtendType(
    node: ts.MethodDeclaration,
    tag: ts.JSDocTag,
    parentType: string | null,
  ) {
    const methodName = this.expectNameIdentifier(node.name);
    if (methodName == null) return null;

    const name = this.entityName(node, tag);
    if (name == null) return null;

    const classNode = node.parent;

    if (!ts.isClassDeclaration(classNode)) {
      return this.report(classNode, E.staticMethodOnNonClass(), [
        tsRelated(tag, "Field defined here"),
      ]);
    }
    const classBlameNode = classNode.name ?? classNode;

    if (!ts.isSourceFile(classNode.parent)) {
      return this.report(classBlameNode, E.staticMethodClassNotTopLevel(), [
        tsRelated(tag, "Field defined here"),
      ]);
    }

    let exportName: ts.Identifier | null = null;

    const isExported = classNode.modifiers?.some((modifier) => {
      return modifier.kind === ts.SyntaxKind.ExportKeyword;
    });

    if (!isExported) {
      return this.report(
        classBlameNode,
        E.staticMethodFieldClassNotExported(),
        [tsRelated(tag, "Field defined here")],
        {
          fixName: "add-export-keyword-to-class",
          description: "Add export keyword to class with static @gqlField",
          changes: [Act.prefixNode(classNode, "export ")],
        },
      );
    }
    const isDefault = classNode.modifiers?.some((modifier) => {
      return modifier.kind === ts.SyntaxKind.DefaultKeyword;
    });

    if (!isDefault) {
      if (classNode.name == null) {
        return this.report(
          classBlameNode,
          E.staticMethodClassWithNamedExportNotNamed(),
          [tsRelated(tag, "Field defined here")],
        );
      }
      const className = this.expectNameIdentifier(classNode.name);
      if (className == null) return null;

      exportName = className;
    }

    this.collectAbstractField(node, exportName, methodName, name, parentType);
  }

  /**
   * Runs the parser code in `cb` over the source text and reports any errors at
   * `node`.
   *
   * Ideally we could use GraphQL `Source` with a `locationOffset`, but for
   * parsing text in docblocks which might span multiple lines, it's not as
   * simple as providing an offset since the lines in the source text might be
   * prefixed with indentation and `*`s.
   */
  parseGql<T>(
    node: ts.Node,
    source: string,
    cb: (parser: Parser) => T,
  ): T | null {
    const parser = new Parser(source);
    try {
      parser.expectToken(TokenKind.SOF);
      const result = cb(parser);
      parser.expectToken(TokenKind.EOF);
      return result;
    } catch (err) {
      if (err instanceof GraphQLError) {
        this.report(node, err.message);
      } else {
        throw err;
      }
    }
    return null;
  }

  collectDirectives(node: ts.Node): ConstDirectiveNode[] {
    const directives: ConstDirectiveNode[] = [];
    for (const tag of ts.getJSDocTags(node)) {
      if (tag.tagName.text !== ANNOTATE_TAG) {
        continue;
      }
      if (typeof tag.comment !== "string") {
        this.report(tag, "Expected docblock tag to have a value.");
        continue;
      }
      const directiveText = `@${tag.comment}`;
      const directive = this.parseGql(tag, directiveText, (parser) => {
        return parser.parseDirective(true);
      });
      if (directive != null) {
        directives.push({ ...directive, loc: loc(tag) });
      }
    }

    const tag = this.findTag(node, DEPRECATED_TAG);
    if (tag != null) {
      let reason: ConstArgumentNode | null = null;
      if (tag.comment != null) {
        const reasonComment = ts.getTextOfJSDocComment(tag.comment);
        if (reasonComment != null) {
          // FIXME: Use the _value_'s location not the tag's
          reason = this.gql.constArgument(
            tag,
            this.gql.name(tag, "reason"),
            this.gql.string(tag, reasonComment),
          );
        }
      }

      directives.push(
        this.gql.constDirective(
          tag.tagName,
          this.gql.name(node, DEPRECATED_TAG),
          reason == null ? null : [reason],
        ),
      );
    }

    return directives;
  }

  collectAbstractField(
    node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction,
    exportName: ts.Identifier | null,
    methodName: ts.Identifier | null,
    name: NameNode,
    parentType: string | null,
  ) {
    if (node.type == null) {
      // TODO: Make error generic
      this.errors.push(gqlErr(name, E.invalidReturnTypeForFunctionField()));
      return;
    }

    const args = this.collectAbstractFieldArgs(node, name, parentType);
    if (args == null) return;

    const type = this.collectType(node.type, { kind: "OUTPUT" });
    if (type == null) return null;

    const tsModulePath = relativePath(node.getSourceFile().fileName);

    const directives = this.collectDirectives(node);

    const description = this.collectDescription(node);

    const killsParentOnException = this.killsParentOnException(node);

    const field = this.gql.fieldDefinition(
      node,
      name,
      type,
      args.args,
      directives,
      description,
      killsParentOnException,
      methodName == null
        ? {
            kind: "function",
            path: tsModulePath,
            exportName: exportName == null ? null : exportName.text,
            arguments: args.resolverParams,
            node,
          }
        : {
            kind: "staticMethod",
            path: tsModulePath,
            exportName: exportName == null ? null : exportName.text,
            arguments: args.resolverParams,
            name: methodName.text,
            node,
          },
    );
    this.definitions.push(
      this.gql.abstractFieldDefinition(
        node,
        args.typeName,
        field,
        parentType == null,
      ),
    );
  }

  collectAbstractFieldArgs(
    node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction,
    name: NameNode,
    parentType: string | null,
  ): {
    resolverParams: ResolverArgument[];
    args: readonly InputValueDefinitionNode[] | null;
    typeName: NameNode;
  } | null {
    if (parentType != null) {
      const paramResults = this.resolverParams(node.parameters);
      if (paramResults == null) return null;
      return {
        args: paramResults.args,
        resolverParams: paramResults.resolverParams,
        typeName: this.gql.name(node, parentType),
      };
    }

    // If the typename is not hard coded, we must infer it from the initial parameter
    const [typeParam, ...restParams] = node.parameters;
    if (typeParam == null) {
      // TODO: Make error generic
      this.errors.push(gqlErr(name, E.invalidParentArgForFunctionField()));
      return null;
    }
    const typeName = this.typeReferenceFromParam(typeParam);
    if (typeName == null) return null;
    const paramResults = this.resolverParams(restParams);
    if (paramResults == null) return null;

    const resolverParams: ResolverArgument[] = [
      { kind: "source", node: typeParam },
      ...paramResults.resolverParams,
    ];
    return { typeName, args: paramResults.args, resolverParams };
  }

  typeReferenceFromParam(typeParam: ts.ParameterDeclaration): NameNode | null {
    if (typeParam.type == null) {
      return this.report(typeParam, E.functionFieldParentTypeMissing());
    }
    if (!ts.isTypeReferenceNode(typeParam.type)) {
      return this.report(typeParam.type, E.functionFieldParentTypeNotValid());
    }

    const typeName = this.gql.name(
      typeParam.type.typeName,
      UNRESOLVED_REFERENCE_NAME,
    );
    this.markUnresolvedType(typeParam.type.typeName, typeName);
    return typeName;
  }

  // A little awkward that null here is both semantic or an indication of an error.
  namedFunctionExportName(node: ts.FunctionDeclaration): ts.Identifier | null {
    if (node.name == null) {
      return this.report(node, E.functionFieldNotNamed());
    }
    const isExported = node.modifiers?.some((modifier) => {
      return modifier.kind === ts.SyntaxKind.ExportKeyword;
    });

    if (!isExported) {
      return this.report(node.name, E.functionFieldNotNamedExport(), [], {
        fixName: "add-export-keyword-to-function",
        description: "Add export keyword to function with @gqlField",
        changes: [Act.prefixNode(node, "export ")],
      });
    }
    const defaultKeyword = node.modifiers?.find((modifier) => {
      return modifier.kind === ts.SyntaxKind.DefaultKeyword;
    });

    if (defaultKeyword != null) {
      return null;
    }
    return node.name;
  }

  scalarTypeAliasDeclaration(node: ts.TypeAliasDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    const description = this.collectDescription(node);
    this.recordTypeName(node, name, "SCALAR");

    const directives = this.collectDirectives(node);

    const isExported = node.modifiers?.find(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!isExported) {
      this.report(node.name, E.scalarNotExported(), [], {
        fixName: "add-export-keyword-to-scalar",
        description: "Add export keyword to type alias with @gqlScalar",
        changes: [Act.prefixNode(node, "export ")],
      });
    }

    const exported: ExportDefinition = {
      tsModulePath: relativePath(node.getSourceFile().fileName),
      exportName: node.name.text,
    };

    this.definitions.push(
      this.gql.scalarTypeDefinition(
        node,
        name,
        directives,
        description,
        exported,
      ),
    );
  }

  inputTypeAliasDeclaration(node: ts.TypeAliasDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    const description = this.collectDescription(node);
    this.recordTypeName(node, name, "INPUT_OBJECT");

    let fields: InputValueDefinitionNode[] | null = null;

    const directives = this.collectDirectives(node);
    if (ts.isUnionTypeNode(node.type)) {
      directives.push(
        this.gql.constDirective(node, this.gql.name(node.type, ONE_OF_TAG), []),
      );

      fields = this.extractOneOfInputFields(node.type);
    } else {
      fields = this.collectInputFields(node);
    }

    if (fields == null) return;

    this.definitions.push(
      this.gql.inputObjectTypeDefinition(
        node,
        name,
        fields,
        directives,
        description,
      ),
    );
  }

  inputInterfaceDeclaration(node: ts.InterfaceDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    const description = this.collectDescription(node);
    this.recordTypeName(node, name, "INPUT_OBJECT");

    const fields: Array<InputValueDefinitionNode> = [];

    for (const member of node.members) {
      if (!ts.isPropertySignature(member)) {
        this.reportUnhandled(
          member,
          "input field",
          E.inputTypeFieldNotProperty(),
        );
        continue;
      }
      const field = this.collectInputField(member);
      if (field != null) fields.push(field);
    }

    this.interfaceDeclarations.push(node);

    const directives = this.collectDirectives(node);

    this.definitions.push(
      this.gql.inputObjectTypeDefinition(
        node,
        name,
        fields,
        directives,
        description,
      ),
    );
  }

  extractOneOfInputFields(
    node: ts.UnionTypeNode,
  ): Array<InputValueDefinitionNode> | null {
    if (!semverGte(graphqlJSVersion, ONE_OF_MIN_GRAPHQL_JS_VERSION)) {
      return this.report(
        node,
        E.oneOfNotSupportedGraphql(
          ONE_OF_MIN_GRAPHQL_JS_VERSION,
          graphqlJSVersion,
        ),
      );
    }
    const fields: InputValueDefinitionNode[] = [];
    for (const member of node.types) {
      const field = this.collectOneOfInputField(member);
      if (field != null) {
        fields.push(field);
      }
    }

    return fields;
  }

  collectOneOfInputField(node: ts.TypeNode): InputValueDefinitionNode | null {
    if (!ts.isTypeLiteralNode(node) || node.members.length !== 1) {
      return this.report(node, E.oneOfFieldNotTypeLiteralWithOneProperty());
    }

    const property = node.members[0];
    if (!ts.isPropertySignature(property)) {
      return this.report(property, E.oneOfFieldNotTypeLiteralWithOneProperty());
    }

    if (property.type == null) {
      return this.report(property, E.oneOfPropertyMissingTypeAnnotation());
    }

    const description = this.collectDescription(property);
    const name = this.expectNameIdentifier(property.name);
    if (name == null) return null;

    const inner = this.collectType(property.type, { kind: "INPUT" });
    if (inner == null) return null;

    // All fields must be nullable since only one will be present at a time.
    const type = this.gql.nullableType(inner);
    return this.gql.inputValueDefinition(
      node,
      this.gql.name(name, name.text),
      type,
      [],
      null,
      description,
    );
  }

  collectInputFields(
    node: ts.TypeAliasDeclaration,
  ): Array<InputValueDefinitionNode> | null {
    const fields: Array<InputValueDefinitionNode> = [];

    if (!ts.isTypeLiteralNode(node.type)) {
      return this.reportUnhandled(node, "input", E.inputTypeNotLiteral());
    }

    for (const member of node.type.members) {
      if (!ts.isPropertySignature(member)) {
        this.reportUnhandled(
          member,
          "input field",
          E.inputTypeFieldNotProperty(),
        );
        continue;
      }
      const field = this.collectInputField(member);
      if (field != null) fields.push(field);
    }

    return fields.length === 0 ? null : fields;
  }

  collectInputField(
    node: ts.PropertySignature,
  ): InputValueDefinitionNode | null {
    const id = this.expectNameIdentifier(node.name);
    if (id == null) return null;

    if (node.type == null) {
      return this.report(node, E.inputFieldUntyped());
    }

    const inner = this.collectType(node.type, { kind: "INPUT" });
    if (inner == null) return null;

    const type =
      node.questionToken == null ? inner : this.gql.nullableType(inner);

    const description = this.collectDescription(node);

    const directives = this.collectDirectives(node);

    return this.gql.inputValueDefinition(
      node,
      this.gql.name(id, id.text),
      type,
      directives,
      null,
      description,
    );
  }

  typeClassDeclaration(node: ts.ClassDeclaration, tag: ts.JSDocTag) {
    if (node.name == null) {
      return this.report(node, E.typeTagOnUnnamedClass());
    }

    const name = this.entityName(node, tag);
    if (name == null) return null;

    this.validateOperationTypes(node.name, name.value);

    const description = this.collectDescription(node);
    const fieldMembers = node.members.filter((member) => {
      // Static methods are handled when we encounter the tag at our top-level
      // traversal, similar to how functions are handled. We filter them out here to ensure
      // we don't double-visit them.
      return !isStaticMethod(member);
    });
    const fields = this.collectFields(fieldMembers);
    const interfaces = this.collectInterfaces(node);
    this.recordTypeName(node, name, "TYPE");

    const hasTypeName = this.checkForTypenameProperty(node, name.value);

    let exported: { tsModulePath: string; exportName: string | null } | null =
      null;
    if (!hasTypeName) {
      const isExported = node.modifiers?.find(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      );
      const isDefault = node.modifiers?.find(
        (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
      );
      if (isExported) {
        exported = {
          tsModulePath: relativePath(node.getSourceFile().fileName),
          exportName: isDefault ? null : node.name.text,
        };
      }
    }

    const directives = this.collectDirectives(node);

    this.definitions.push(
      this.gql.objectTypeDefinition(
        node,
        name,
        fields,
        interfaces,
        description,
        directives,
        hasTypeName,
        exported,
      ),
    );
  }

  validateOperationTypes(node: ts.Node, name: string) {
    // TODO: If we start supporting defining operation types using
    // non-standard names, we will need to update this logic.
    if (OPERATION_TYPES.has(name)) {
      this.report(node, E.operationTypeNotUnknown());
    }
  }

  typeInterfaceDeclaration(node: ts.InterfaceDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    this.validateOperationTypes(node.name, name.value);

    const description = this.collectDescription(node);
    const fields = this.collectFields(node.members);
    const interfaces = this.collectInterfaces(node);
    this.recordTypeName(node, name, "TYPE");

    const hasTypeName = this.checkForTypenameProperty(node, name.value);

    const directives = this.collectDirectives(node);

    this.definitions.push(
      this.gql.objectTypeDefinition(
        node,
        name,
        fields,
        interfaces,
        description,
        directives,
        hasTypeName,
        null,
      ),
    );
  }

  typeTypeAliasDeclaration(node: ts.TypeAliasDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    let fields: FieldDefinitionNode[] = [];
    let interfaces: NamedTypeNode[] | null = null;

    let hasTypeName = false;

    if (ts.isTypeLiteralNode(node.type)) {
      this.validateOperationTypes(node.type, name.value);
      fields = this.collectFields(node.type.members);
      interfaces = this.collectInterfaces(node);
      hasTypeName = this.checkForTypenameProperty(node.type, name.value);
    } else if (node.type.kind === ts.SyntaxKind.UnknownKeyword) {
      // This is fine, we just don't know what it is. This should be the expected
      // case for operation types such as `Query`, `Mutation`, and `Subscription`
      // where there is not strong convention around.
    } else {
      return this.report(node.type, E.typeTagOnAliasOfNonObjectOrUnknown());
    }

    const description = this.collectDescription(node);
    this.recordTypeName(node, name, "TYPE");

    const directives = this.collectDirectives(node);

    this.definitions.push(
      this.gql.objectTypeDefinition(
        node,
        name,
        fields,
        interfaces,
        description,
        directives,
        hasTypeName,
        null,
      ),
    );
  }

  checkForTypenameProperty(
    node: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeLiteralNode,
    expectedName: string,
  ): boolean {
    const hasTypename = node.members.some((member) => {
      return this.isValidTypeNameProperty(member, expectedName);
    });
    if (hasTypename) {
      this.typesWithTypename.add(expectedName);
      return true;
    }
    return false;
  }

  isValidTypeNameProperty(
    member: ts.ClassElement | ts.TypeElement,
    expectedName: string,
  ): boolean {
    if (
      member.name == null ||
      !ts.isIdentifier(member.name) ||
      member.name.text !== "__typename"
    ) {
      return false;
    }

    if (ts.isPropertyDeclaration(member)) {
      return this.isValidTypenamePropertyDeclaration(member, expectedName);
    }
    if (ts.isPropertySignature(member)) {
      return this.isValidTypenamePropertySignature(member, expectedName);
    }

    // TODO: Could show what kind we found, but TS AST does not have node names.
    this.report(member.name, E.typeNameNotDeclaration());
    return false;
  }

  isValidTypenamePropertyDeclaration(
    node: ts.PropertyDeclaration,
    expectedName: string,
  ): boolean {
    // If we have a type annotation, we ask that it be a string literal.
    // That means, that if we have one, _and_ it's valid, we're done.
    // Otherwise we fall through to the initializer check.
    if (node.type != null) {
      return this.isValidTypenamePropertyType(node.type, expectedName);
    }
    if (node.initializer == null) {
      this.report(
        node.name,
        E.typeNameMissingInitializer(),
        [],
        this.fixTypenameProperty(node, expectedName),
      );
      return false;
    }

    if (!ts.isAsExpression(node.initializer)) {
      this.report(
        node.initializer,
        E.typeNameInitializeNotExpression(expectedName),
        [],
        this.fixTypenameProperty(node, expectedName),
      );
      return false;
    }

    if (!ts.isStringLiteral(node.initializer.expression)) {
      this.report(
        node.initializer.expression,
        E.typeNameInitializeNotString(expectedName),
        [],
        this.fixTypenameProperty(node, expectedName),
      );
      return false;
    }

    if (node.initializer.expression.text !== expectedName) {
      this.report(
        node.initializer.expression,
        E.typeNameInitializerWrong(
          expectedName,
          node.initializer.expression.text,
        ),
        [],
        this.fixTypenameProperty(node, expectedName),
      );
      return false;
    }

    if (!ts.isTypeReferenceNode(node.initializer.type)) {
      this.report(
        node.initializer.type,
        E.typeNameTypeNotReferenceNode(expectedName),
        [],
        this.fixTypenameProperty(node, expectedName),
      );
      return false;
    }

    if (!ts.isIdentifier(node.initializer.type.typeName)) {
      this.report(
        node.initializer.type.typeName,
        E.typeNameTypeNameNotIdentifier(expectedName),
        [],
        this.fixTypenameProperty(node, expectedName),
      );
      return false;
    }

    if (node.initializer.type.typeName.escapedText !== "const") {
      this.report(
        node.initializer.type.typeName,
        E.typeNameTypeNameNotConst(expectedName),
        [],
        this.fixTypenameProperty(node, expectedName),
      );
      return false;
    }

    return true;
  }

  fixTypenameProperty(node: ts.Node, expectedName: string): ts.CodeFixAction {
    return {
      fixName: "fix-typename-property",
      description: "Create Grats-compatible `__typename` property",
      changes: [
        Act.replaceNode(node, `__typename = "${expectedName}" as const;`),
      ],
    };
  }

  fixTypenameType(node: ts.Node, expectedName: string): ts.CodeFixAction {
    return {
      fixName: "fix-typename-type",
      description: "Create Grats-compatible `__typename` type",
      changes: [Act.replaceNode(node, `"${expectedName}"`)],
    };
  }

  isValidTypenamePropertySignature(
    node: ts.PropertySignature,
    expectedName: string,
  ) {
    if (node.type == null) {
      this.report(node, E.typeNameMissingTypeAnnotation(expectedName), [], {
        fixName: "add-typename-type",
        description: "Add Grats-compatible `__typename` type",
        changes: [Act.suffixNode(node, `: "${expectedName}"`)],
      });
      return false;
    }
    return this.isValidTypenamePropertyType(node.type, expectedName);
  }

  isValidTypenamePropertyType(node: ts.TypeNode, expectedName: string) {
    if (!ts.isLiteralTypeNode(node) || !ts.isStringLiteral(node.literal)) {
      this.report(
        node,
        E.typeNameTypeNotStringLiteral(expectedName),
        [],
        this.fixTypenameType(node, expectedName),
      );
      return false;
    }
    if (node.literal.text !== expectedName) {
      this.report(
        node,
        E.typeNameDoesNotMatchExpected(expectedName),
        [],
        this.fixTypenameType(node, expectedName),
      );
      return false;
    }
    return true;
  }

  collectInterfaces(
    node:
      | ts.ClassDeclaration
      | ts.InterfaceDeclaration
      | ts.TypeAliasDeclaration,
  ): Array<NamedTypeNode> | null {
    this.reportTagInterfaces(node);

    return ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)
      ? this.collectHeritageInterfaces(node)
      : null;
  }

  reportTagInterfaces(
    node:
      | ts.TypeAliasDeclaration
      | ts.ClassDeclaration
      | ts.InterfaceDeclaration,
  ) {
    const tag = this.findTag(node, IMPLEMENTS_TAG_DEPRECATED);
    if (tag == null) return null;

    if (node.kind === ts.SyntaxKind.ClassDeclaration) {
      this.report(tag, E.implementsTagDeprecated());
    }
    if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
      this.report(tag, E.implementsTagOnInterface());
    }
    if (node.kind === ts.SyntaxKind.TypeAliasDeclaration) {
      this.report(tag, E.implementsTagOnTypeAlias());
    }
  }

  collectHeritageInterfaces(
    node: ts.ClassDeclaration | ts.InterfaceDeclaration,
  ): Array<NamedTypeNode> | null {
    if (node.heritageClauses == null) return null;

    const maybeInterfaces: Array<NamedTypeNode | null> = node.heritageClauses
      .filter((clause) => {
        if (node.kind === ts.SyntaxKind.ClassDeclaration) {
          return clause.token === ts.SyntaxKind.ImplementsKeyword;
        }
        // Interfaces can only have extends clauses, and those are allowed.
        return true;
      })
      .flatMap((clause): Array<NamedTypeNode | null> => {
        return clause.types
          .map((type) => type.expression)
          .filter((expression): expression is ts.Identifier =>
            ts.isIdentifier(expression),
          )
          .map((expression) => {
            const namedType = this.gql.namedType(
              expression,
              UNRESOLVED_REFERENCE_NAME,
            );
            this.markUnresolvedType(expression, namedType.name);
            return namedType;
          });
      });

    const interfaces = maybeInterfaces.filter(
      (i): i is NamedTypeNode => i != null,
    );

    if (interfaces.length === 0) {
      return null;
    }

    return interfaces;
  }

  interfaceInterfaceDeclaration(
    node: ts.InterfaceDeclaration,
    tag: ts.JSDocTag,
  ) {
    const name = this.entityName(node, tag);
    if (name == null || name.value == null) {
      return;
    }

    this.interfaceDeclarations.push(node);

    const description = this.collectDescription(node);
    const interfaces = this.collectInterfaces(node);

    const fields = this.collectFields(node.members);

    this.recordTypeName(node, name, "INTERFACE");

    const directives = this.collectDirectives(node);

    this.definitions.push(
      this.gql.interfaceTypeDefinition(
        node,
        name,
        fields,
        interfaces,
        description,
        directives,
      ),
    );
  }

  collectFields(
    members: ReadonlyArray<ts.ClassElement | ts.TypeElement>,
  ): Array<FieldDefinitionNode> {
    const fields: FieldDefinitionNode[] = [];
    members.forEach((node) => {
      if (ts.isConstructorDeclaration(node)) {
        // Handle parameter properties
        // https://www.typescriptlang.org/docs/handbook/2/classes.html#parameter-properties
        for (const param of node.parameters) {
          const field = this.constructorParam(param);
          if (field != null) {
            fields.push(field);
          }
        }
      }
      if (
        ts.isMethodDeclaration(node) ||
        ts.isMethodSignature(node) ||
        ts.isGetAccessorDeclaration(node)
      ) {
        const field = this.methodDeclaration(node);
        if (field != null) {
          fields.push(field);
        }
      } else if (
        ts.isPropertyDeclaration(node) ||
        ts.isPropertySignature(node)
      ) {
        const field = this.property(node);
        if (field) {
          fields.push(field);
        }
      }
    });
    return fields;
  }

  constructorParam(node: ts.ParameterDeclaration): FieldDefinitionNode | null {
    const tag = this.findTag(node, FIELD_TAG);
    if (tag == null) return null;
    if (node.modifiers == null) {
      return this.report(node, E.parameterWithoutModifiers(), [], {
        fixName: "add-public-modifier",
        description: "Add 'public' modifier",
        changes: [Act.prefixNode(node.name!, "public ")],
      });
    }

    const isParameterProperty = node.modifiers.some(
      (modifier) =>
        modifier.kind === ts.SyntaxKind.PublicKeyword ||
        modifier.kind === ts.SyntaxKind.PrivateKeyword ||
        modifier.kind === ts.SyntaxKind.ProtectedKeyword ||
        modifier.kind === ts.SyntaxKind.ReadonlyKeyword,
    );

    if (!isParameterProperty) {
      return this.report(node, E.parameterWithoutModifiers(), [], {
        fixName: "add-public-modifier-to-existing",
        description: "Add 'public' modifier",
        changes: [Act.prefixNode(node.name!, "public ")],
      });
    }

    const notPublic = node.modifiers.find(
      (modifier) =>
        modifier.kind === ts.SyntaxKind.PrivateKeyword ||
        modifier.kind === ts.SyntaxKind.ProtectedKeyword,
    );

    if (notPublic != null) {
      return this.report(notPublic, E.parameterPropertyNotPublic(), [], {
        fixName: "make-parameter-property-public",
        description: "Make parameter property public",
        changes: [Act.replaceNode(notPublic, "public")],
      });
    }

    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (node.type == null) {
      return this.report(node, E.parameterPropertyMissingType());
    }

    const id = node.name;
    if (ts.isArrayBindingPattern(id) || ts.isObjectBindingPattern(id)) {
      // TypeScript triggers an error if a binding pattern is used for a
      // parameter property, so we don't need to report them.
      // https://www.typescriptlang.org/play?#code/MYGwhgzhAEBiD29oG8BQ1rHgOwgFwCcBXYPeAgCgAciAjEAS2BQDNEBfAShXdXaA
      return null;
    }
    const directives = this.collectDirectives(node);

    const type = this.collectType(node.type, { kind: "OUTPUT" });
    if (type == null) return null;

    const description = this.collectDescription(node);

    const killsParentOnException = this.killsParentOnException(node);

    return this.gql.fieldDefinition(
      node,
      name,
      type,
      null,
      directives,
      description,
      killsParentOnException,
      {
        kind: "property",
        name: id.text,
        node,
      },
    );
  }

  collectArgDefaults(node: ts.ObjectBindingPattern): ArgDefaults {
    const defaults = new Map();
    for (const element of node.elements) {
      const name = element.propertyName ?? element.name;
      if (
        ts.isBindingElement(element) &&
        element.initializer &&
        ts.isIdentifier(name)
      ) {
        defaults.set(name.text, element.initializer);
      }
    }
    return defaults;
  }

  collectConstValue(node: ts.Expression): ConstValueNode | null {
    if (ts.isStringLiteral(node)) {
      return this.gql.string(node, node.text);
    } else if (ts.isNoSubstitutionTemplateLiteral(node)) {
      return this.gql.string(node, node.text);
    } else if (ts.isNumericLiteral(node)) {
      return node.text.includes(".")
        ? this.gql.float(node, node.text)
        : this.gql.int(node, node.text);
    } else if (this.isNullish(node)) {
      return this.gql.null(node);
    } else if (node.kind === ts.SyntaxKind.TrueKeyword) {
      return this.gql.boolean(node, true);
    } else if (node.kind === ts.SyntaxKind.FalseKeyword) {
      return this.gql.boolean(node, false);
    } else if (ts.isObjectLiteralExpression(node)) {
      return this.collectObjectLiteral(node);
    } else if (ts.isArrayLiteralExpression(node)) {
      return this.collectArrayLiteral(node);
    } else if (ts.isPropertyAccessExpression(node)) {
      // Note: The text of the property access name may not actually be the
      // value of the enum. For example, the enum may have a value of `1` but
      // the property access name may be `ONE`.
      //
      // A later transform (after we become type aware) takes care of fixing
      // this up.
      return this.gql.enum(node, node.name.text);
    }
    return this.reportUnhandled(
      node,
      "constant value",
      E.defaultValueIsNotLiteral(),
    );
  }

  collectArrayLiteral(
    node: ts.ArrayLiteralExpression,
  ): ConstListValueNode | null {
    const values: ConstValueNode[] = [];
    let errors = false;
    for (const element of node.elements) {
      const value = this.collectConstValue(element);
      if (value == null) {
        errors = true;
      } else {
        values.push(value);
      }
    }
    if (errors) {
      return null;
    }
    return this.gql.list(node, values);
  }

  collectObjectLiteral(
    node: ts.ObjectLiteralExpression,
  ): ConstObjectValueNode | null {
    const fields: ConstObjectFieldNode[] = [];
    let errors = false;
    for (const property of node.properties) {
      const field = this.collectObjectField(property);
      if (field == null) {
        errors = true;
      } else {
        fields.push(field);
      }
    }
    if (errors) {
      return null;
    }
    return this.gql.object(node, fields);
  }

  collectObjectField(
    node: ts.ObjectLiteralElementLike,
  ): ConstObjectFieldNode | null {
    if (!ts.isPropertyAssignment(node)) {
      return this.reportUnhandled(
        node,
        "constant value",
        E.defaultArgElementIsNotAssignment(),
      );
    }
    if (node.name == null) {
      return this.reportUnhandled(
        node,
        "field",
        E.defaultArgPropertyMissingName(),
      );
    }
    const name = this.expectNameIdentifier(node.name);
    if (name == null) return null;
    const initialize = node.initializer;
    if (initialize == null) {
      return this.report(node, E.defaultArgPropertyMissingInitializer());
    }

    const value = this.collectConstValue(initialize);
    if (value == null) return null;
    return this.gql.constObjectField(
      node,
      this.gql.name(node.name, name.text),
      value,
    );
  }

  collectArg(
    node: ts.TypeElement,
    defaults?: Map<string, ts.Expression> | null,
  ): InputValueDefinitionNode | null {
    if (!ts.isPropertySignature(node)) {
      // TODO: How can I create this error?
      return this.report(node, E.argIsNotProperty());
    }
    if (!ts.isIdentifier(node.name)) {
      // TODO: How can I create this error?
      return this.report(node.name, E.argNameNotLiteral());
    }

    if (node.type == null) {
      return this.report(node.name, E.argNotTyped());
    }
    let type = this.collectType(node.type, { kind: "INPUT" });
    if (type == null) return null;

    if (type.kind !== Kind.NON_NULL_TYPE && !node.questionToken) {
      // If a field is passed an argument value, and that argument is not defined in the request,
      // `graphql-js` will not define the argument property. Therefore we must ensure the argument
      // is not just nullable, but optional.
      return this.report(
        node.name,
        E.expectedNullableArgumentToBeOptional(),
        [],
        {
          fixName: "add-question-token-to-arg",
          description: "Make argument optional",
          changes: [Act.suffixNode(node.name, "?")],
        },
      );
    }

    let defaultValue: ConstValueNode | null = null;
    if (defaults != null) {
      const def = defaults.get(node.name.text);
      if (def != null) {
        defaultValue = this.collectConstValue(def);
      }
    }

    if (node.questionToken && defaultValue == null) {
      // Question mark means we can handle the argument being undefined in the
      // object literal, but if we are going to type the GraphQL arg as
      // optional, the code must also be able to handle an explicit null.
      //
      // ... unless there is a default value. In that case, the default will be
      // used argument is omitted or references an undefined variable.

      // TODO: This will catch { a?: string } but not { a?: string | undefined }.
      if (type.kind === Kind.NON_NULL_TYPE) {
        return this.report(
          node.questionToken,
          E.nonNullTypeCannotBeOptional(),
          [],
          {
            fixName: "add-null-to-optional-type",
            description: "Add '| null' to the type",
            changes: [Act.suffixNode(node.type!, " | null")],
          },
        );
      }
      type = this.gql.nullableType(type);
    }

    const description = this.collectDescription(node);

    const directives = this.collectDirectives(node);

    return this.gql.inputValueDefinition(
      node,
      this.gql.name(node.name, node.name.text),
      type,
      directives,
      defaultValue,
      description,
    );
  }

  enumEnumDeclaration(node: ts.EnumDeclaration, tag: ts.JSDocTag): void {
    const name = this.entityName(node, tag);
    if (name == null || name.value == null) {
      return;
    }

    // Check if enum must be exported when tsClientEnums is configured
    let exported: { tsModulePath: string; exportName: string | null } | null =
      null;
    const isExported = node.modifiers?.some((modifier) => {
      return modifier.kind === ts.SyntaxKind.ExportKeyword;
    });

    if (this.config?.tsClientEnums != null && !isExported) {
      this.report(node, E.enumNotExported(), [], {
        fixName: "add-export-keyword-to-enum",
        description: "Add export keyword to enum with @gqlEnum",
        changes: [Act.prefixNode(node, "export ")],
      });
      return;
    }

    if (isExported) {
      const isDefault = node.modifiers?.find(
        (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
      );
      exported = {
        tsModulePath: relativePath(node.getSourceFile().fileName),
        exportName: isDefault ? null : (node.name?.text ?? null),
      };
    }

    const description = this.collectDescription(node);

    const values = this.collectEnumValues(node);

    this.recordTypeName(node, name, "ENUM");

    const directives = this.collectDirectives(node);

    this.definitions.push(
      this.gql.enumTypeDefinition(
        node,
        name,
        values,
        description,
        directives,
        exported,
      ),
    );
  }

  enumTypeAliasDeclaration(
    node: ts.TypeAliasDeclaration,
    tag: ts.JSDocTag,
  ): void {
    const name = this.entityName(node, tag);
    if (name == null || name.value == null) {
      return;
    }

    // Prohibit type alias enums when tsClientEnums is configured
    if (this.config?.tsClientEnums != null) {
      this.report(node, E.typeAliasEnumNotSupportedWithEmitEnums());
      return;
    }

    const values = this.enumTypeAliasVariants(node);
    if (values == null) return;

    const description = this.collectDescription(node);
    this.recordTypeName(node, name, "ENUM");

    const directives = this.collectDirectives(node);

    this.definitions.push(
      this.gql.enumTypeDefinition(
        node,
        name,
        values,
        description,
        directives,
        null,
      ),
    );
  }

  enumTypeAliasVariants(
    node: ts.TypeAliasDeclaration,
  ): EnumValueDefinitionNode[] | null {
    // Semantically we only support deriving enums from type aliases that
    // are unions of string literals. However, in the edge case of a union
    // of one item, there is no way to construct a union type of one item in
    // TypeScript. So, we also support deriving enums from type aliases of a single
    // string literal.
    if (
      ts.isLiteralTypeNode(node.type) &&
      ts.isStringLiteral(node.type.literal)
    ) {
      return [
        this.gql.enumValueDefinition(
          node,
          this.gql.name(node.type.literal, node.type.literal.text),
          undefined,
          null,
          null,
        ),
      ];
    }

    if (!ts.isUnionTypeNode(node.type)) {
      this.reportUnhandled(node.type, "union", E.enumTagOnInvalidNode());
      return null;
    }

    const values: EnumValueDefinitionNode[] = [];
    for (const member of node.type.types) {
      if (
        !ts.isLiteralTypeNode(member) ||
        !ts.isStringLiteral(member.literal)
      ) {
        this.reportUnhandled(
          member,
          "union member",
          E.enumVariantNotStringLiteral(),
        );
        continue;
      }

      const directives = this.collectDirectives(member);

      // TODO: Support descriptions on enum members. As it stands, TypeScript
      // does not allow comments attached to string literal types.
      values.push(
        this.gql.enumValueDefinition(
          node,
          this.gql.name(member.literal, member.literal.text),
          directives,
          null,
          null,
        ),
      );
    }

    return values;
  }

  collectEnumValues(
    node: ts.EnumDeclaration,
  ): ReadonlyArray<EnumValueDefinitionNode> {
    const values: EnumValueDefinitionNode[] = [];

    for (const member of node.members) {
      if (
        member.initializer == null ||
        !ts.isStringLiteral(member.initializer)
      ) {
        this.reportUnhandled(
          member,
          "enum value",
          E.enumVariantMissingInitializer(),
        );
        continue;
      }

      const errorMessage = graphQLNameValidationMessage(
        member.initializer.text,
      );
      if (errorMessage != null) {
        this.report(member.initializer, errorMessage);
      }

      const description = this.collectDescription(member);
      const directives = this.collectDirectives(member);

      values.push(
        this.gql.enumValueDefinition(
          member,
          this.gql.name(member.initializer, member.initializer.text),
          directives,
          description,
          member.name.getText(),
        ),
      );
    }

    return values;
  }

  entityName(
    node:
      | ts.ClassDeclaration
      | ts.MethodDeclaration
      | ts.GetAccessorDeclaration
      | ts.MethodSignature
      | ts.PropertyDeclaration
      | ts.InterfaceDeclaration
      | ts.PropertySignature
      | ts.EnumDeclaration
      | ts.TypeAliasDeclaration
      | ts.FunctionDeclaration
      | ts.VariableDeclaration
      | ts.ParameterDeclaration,
    tag: ts.JSDocTag,
  ) {
    if (tag.comment != null) {
      const commentName = ts.getTextOfJSDocComment(tag.comment);
      if (commentName != null) {
        // FIXME: Use the _value_'s location not the tag's
        const locNode = tag;

        // Test for leading newlines using the raw text
        const hasLeadingNewlines = /\n/.test(
          trimTrailingCommentLines(tag.getText()),
        );
        const hasInternalWhitespace = /\s/.test(commentName);
        const validationMessage = graphQLNameValidationMessage(commentName);

        if (hasLeadingNewlines && validationMessage == null) {
          // TODO: Offer quick fix.
          return this.report(
            locNode,
            E.graphQLNameHasLeadingNewlines(commentName, tag.tagName.text),
          );
        }

        if (hasLeadingNewlines || hasInternalWhitespace) {
          return this.report(
            locNode,
            E.graphQLTagNameHasWhitespace(tag.tagName.text),
          );
        }

        // No whitespace, but still invalid. We will assume they meant this to
        // be a GraphQL name but didn't provide a valid identifier.
        //
        // NOTE: We can't let GraphQL validation handle this, because it throws rather
        // than returning a validation message. Presumably because it expects token
        // validation to be done during lexing/parsing.
        if (validationMessage !== null) {
          return this.report(locNode, validationMessage);
        }
        return this.gql.name(locNode, commentName);
      }
    }

    if (node.name == null) {
      return this.report(node, E.gqlEntityMissingName());
    }
    const id = this.expectNameIdentifier(node.name);
    if (id == null) return null;
    return this.gql.name(id, id.text);
  }

  methodDeclaration(
    node: ts.MethodDeclaration | ts.MethodSignature | ts.GetAccessorDeclaration,
  ): FieldDefinitionNode | null {
    const tag = this.findTag(node, FIELD_TAG);
    if (tag == null) return null;

    if (node.modifiers != null) {
      for (const modifier of node.modifiers) {
        switch (modifier.kind) {
          case ts.SyntaxKind.PrivateKeyword:
          case ts.SyntaxKind.ProtectedKeyword:
            this.report(modifier, E.invalidFieldNonPublicAccessModifier());
            break;
          case ts.SyntaxKind.StaticKeyword:
            // Return early here, since static methods expect a parent object as
            // first argument rather than args, and we don't want to emit
            // confusing error messages
            // Note: We expect that static methods are handled at the top-level
            // and will be filtered out before getting here, so this just
            // catches static property signatures which are also invalid
            // TypeScript.
            return this.report(modifier, E.invalidStaticModifier());
        }
      }
    }

    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (node.type == null) {
      return this.report(node.name, E.methodMissingType());
    }

    const type = this.collectType(node.type, { kind: "OUTPUT" });
    if (type == null) return null;

    // We already reported an error
    if (type == null) return null;

    const paramResults = this.resolverParams(node.parameters);
    if (paramResults == null) return null;
    const { resolverParams, args } = paramResults;

    const description = this.collectDescription(node);

    const id = this.expectNameIdentifier(node.name);
    if (id == null) return null;
    const directives = this.collectDirectives(node);

    const killsParentOnException = this.killsParentOnException(node);

    return this.gql.fieldDefinition(
      node,
      name,
      type,
      args,
      directives,
      description,
      killsParentOnException,
      isCallable(node)
        ? {
            kind: "method",
            name: id.text === name.value ? null : id.text,
            arguments: resolverParams,
            node,
          }
        : {
            kind: "property",
            name: id.text === name.value ? null : id.text,
            node,
          },
    );
  }

  // A resolver may have some number of positional args `resolverParams`. It may
  // also have at most one object literal argument (`args`), which is treated as
  // a map of named arguments.
  resolverParams(parameters: ReadonlyArray<ts.ParameterDeclaration>): {
    resolverParams: ResolverArgument[];
    args: readonly InputValueDefinitionNode[] | null;
  } | null {
    const resolverParams: ResolverArgument[] = [];

    let args: {
      param: ts.ParameterDeclaration;
      inputs: InputValueDefinitionNode[];
    } | null = null;

    for (const param of parameters) {
      if (param.dotDotDotToken != null) {
        return this.report(
          param.dotDotDotToken,
          E.unexpectedParamSpreadForResolverParam(),
        );
      }
      if (param.type == null) {
        return this.report(param, E.resolverParamIsMissingType());
      }
      if (ts.isTypeLiteralNode(param.type)) {
        if (args != null) {
          return this.report(param, E.multipleResolverTypeLiterals(), [
            tsRelated(args.param, "Previous type literal"),
          ]);
        }
        resolverParams.push({ kind: "argumentsObject", node: param });
        args = { param, inputs: [] };

        let defaults: ArgDefaults | null = null;
        if (ts.isObjectBindingPattern(param.name)) {
          defaults = this.collectArgDefaults(param.name);
        }

        for (const member of param.type.members) {
          const arg = this.collectArg(member, defaults);
          if (arg != null) {
            args.inputs.push(arg);
          }
        }
        continue;
      }

      const inputDefinition = this.collectParamArg(param);
      if (inputDefinition == null) return null;
      resolverParams.push({ kind: "unresolved", inputDefinition, node: param });
    }
    return { resolverParams, args: args ? args.inputs : null };
  }

  collectParamArg(
    param: ts.ParameterDeclaration,
  ): InputValueDefinitionNodeOrResolverArg | null {
    invariant(param.type != null, "Expected type annotation");

    // This param might be info or context, in which case we don't need a name,
    // or it might be a GraphQL argument, in which case we _do_ need a name.
    // However, we don't know which we have until a later phase where were are
    // type-aware.
    // By modeling the name as a diagnostic result, we can defer the decision
    // of whether the name is required until we have more information.
    let name: DiagnosticResult<NameNode> = ts.isIdentifier(param.name)
      ? ok(this.gql.name(param.name, param.name.text))
      : err(tsErr(param.name, E.positionalResolverArgDoesNotHaveName()));

    const type = this.collectType(param.type, { kind: "INPUT" });
    if (type == null) return null;

    let defaultValue: ConstValueNode | null = null;

    if (param.initializer != null) {
      defaultValue = this.collectConstValue(param.initializer);
    }

    if (param.questionToken) {
      // Question mark means we can handle the argument being undefined in the
      // object literal, but if we are going to type the GraphQL arg as
      // optional, the code must also be able to handle an explicit null.
      //
      // In the object map args case we have to consider the possibility of a
      // default value, but TS does not allow default value for optional args,
      // so TS will take care of that for us.
      if (type.kind === Kind.NON_NULL_TYPE) {
        // This is only a problem if the type turns out to be a GraphQL type.
        // If it's info or context, it's fine. So, we defer the error until
        // later when we try to use this as a GraphQL type.
        if (name.kind === "OK") {
          name = err(
            tsErr(param.questionToken, E.nonNullTypeCannotBeOptional(), [], {
              fixName: "add-null-to-optional-parameter-type",
              description: "Add '| null' to the parameter type",
              changes: [Act.suffixNode(param.type!, " | null")],
            }),
          );
        }
      }
    }

    const directives = this.collectDirectives(param);

    return this.gql.inputValueDefinitionOrResolverArg(
      param,
      name,
      type,
      directives,
      defaultValue,
      this.collectDescription(param),
    );
  }

  modifiersAreValidForField(
    node: ts.MethodDeclaration | ts.MethodSignature | ts.GetAccessorDeclaration,
  ): boolean {
    if (node.modifiers == null) return true;

    for (const modifier of node.modifiers) {
      switch (modifier.kind) {
        case ts.SyntaxKind.PrivateKeyword:
        case ts.SyntaxKind.ProtectedKeyword:
          this.report(modifier, E.invalidFieldNonPublicAccessModifier());
          return false;
        case ts.SyntaxKind.StaticKeyword:
          this.report(modifier, E.invalidStaticModifier());
          return false;
      }
    }
    return true;
  }

  collectDescription(node: ts.Node): StringValueNode | null {
    const docs: readonly (ts.JSDoc | ts.JSDocTag)[] =
      // @ts-ignore Exposed as stable in https://github.com/microsoft/TypeScript/pull/53627
      ts.getJSDocCommentsAndTags(node);

    const comment = docs
      .filter((doc) => doc.kind === ts.SyntaxKind.JSDoc)
      .map((doc) => doc.comment)
      .join("");

    if (comment) {
      return this.gql.string(node, comment.trim(), true);
    }
    return null;
  }

  property(
    node: ts.PropertyDeclaration | ts.PropertySignature,
  ): FieldDefinitionNode | null {
    const tag = this.findTag(node, FIELD_TAG);
    if (tag == null) return null;

    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (node.type == null) {
      this.report(node.name, E.propertyFieldMissingType());
      return null;
    }

    const inner = this.collectType(node.type, { kind: "OUTPUT" });
    // We already reported an error
    if (inner == null) return null;
    const type =
      node.questionToken == null ? inner : this.gql.nullableType(inner);

    const description = this.collectDescription(node);

    const id = this.expectNameIdentifier(node.name);
    if (id == null) return null;

    const directives = this.collectDirectives(node);

    const killsParentOnException = this.killsParentOnException(node);

    return this.gql.fieldDefinition(
      node,
      name,
      type,
      null,
      directives,
      description,
      killsParentOnException,
      {
        kind: "property",
        name: id.text === name.value ? null : id.text,
        node,
      },
    );
  }
  // TODO: Support separate modes for input and output types
  // For input nodes and field may only be optional if `null` is a valid value.
  collectType(node: ts.TypeNode, ctx: FieldTypeContext): TypeNode | null {
    if (ts.isTypeReferenceNode(node)) {
      const type = this.typeReference(node, ctx);
      if (type == null) return null;
      return type;
    } else if (ts.isArrayTypeNode(node)) {
      const element = this.collectType(node.elementType, ctx);
      if (element == null) return null;
      return this.gql.nonNullType(node, this.gql.listType(node, element));
    } else if (ts.isUnionTypeNode(node)) {
      const types = node.types.filter((type) => !this.isNullish(type));
      if (types.length === 0) {
        return this.report(node, E.expectedOneNonNullishType());
      }

      const type = this.collectType(types[0], ctx);
      if (type == null) return null;

      if (types.length > 1) {
        const [first, ...rest] = types;
        // FIXME: If each of `rest` matches `first` this should be okay.
        const incompatibleVariants = rest.map((tsType) => {
          return tsRelated(tsType, "Other non-nullish type");
        });
        this.report(first, E.expectedOneNonNullishType(), incompatibleVariants);
        return null;
      }
      if (node.types.length > 1) {
        return this.gql.withLocation(node, this.gql.nullableType(type));
      }
      return this.gql.nonNullType(node, type);
    } else if (ts.isParenthesizedTypeNode(node)) {
      return this.collectType(node.type, ctx);
    } else if (node.kind === ts.SyntaxKind.StringKeyword) {
      return this.gql.nonNullType(node, this.gql.namedType(node, "String"));
    } else if (node.kind === ts.SyntaxKind.BooleanKeyword) {
      return this.gql.nonNullType(node, this.gql.namedType(node, "Boolean"));
    } else if (node.kind === ts.SyntaxKind.NumberKeyword) {
      return this.report(node, E.ambiguousNumberType());
    } else if (ts.isTypeLiteralNode(node)) {
      return this.report(node, E.unsupportedTypeLiteral());
    } else if (ts.isTypeOperatorNode(node)) {
      if (node.operator === ts.SyntaxKind.ReadonlyKeyword) {
        return this.collectType(node.type, ctx);
      }
    }
    // TODO: Better error message. This is okay if it's a type reference, but everything else is not.
    this.reportUnhandled(node, "type", E.unknownGraphQLType());
    return null;
  }

  /**
   * Unwraps a Promise<T> type to T, tracking whether it was async.
   * Returns null if there's an error (e.g., Promise without type arguments).
   */
  maybeUnwrapPromiseType(
    type: ts.TypeNode,
  ): { type: ts.TypeNode; isAsync: boolean } | null {
    if (!ts.isTypeReferenceNode(type)) {
      return { type, isAsync: false };
    }

    const typeName = type.typeName;
    if (ts.isIdentifier(typeName) && typeName.text === "Promise") {
      if (type.typeArguments == null || type.typeArguments.length !== 1) {
        //
        this.report(type, E.wrapperMissingTypeArg(typeName.text));
        return null;
      }
      return { type: type.typeArguments[0], isAsync: true };
    }

    return { type, isAsync: false };
  }

  typeReference(
    node: ts.TypeReferenceNode,
    ctx: FieldTypeContext,
  ): TypeNode | null {
    const identifier = this.expectNameIdentifier(node.typeName);
    if (identifier == null) return null;

    const typeName = identifier.text;
    // Some types are not valid as input types. Validate that here:
    if (ctx.kind === "INPUT") {
      switch (typeName) {
        case "AsyncIterable":
          return this.report(
            node,
            "`AsyncIterable` is not a valid as an input type.",
          );
        case "Promise":
          return this.report(
            node,
            "`Promise` is not a valid as an input type.",
          );
      }
    }
    switch (typeName) {
      case "Array":
      case "Iterator":
      case "ReadonlyArray":
      case "AsyncIterable": {
        if (node.typeArguments == null) {
          return this.report(node, E.pluralTypeMissingParameter());
        }
        const element = this.collectType(node.typeArguments[0], ctx);
        if (element == null) return null;
        const listType = this.gql.listType(node, element);
        if (typeName === "AsyncIterable") {
          listType.isAsyncIterable = true;
        }
        return this.gql.nonNullType(node, listType);
      }
      case "Promise": {
        const unwrapped = this.maybeUnwrapPromiseType(node);
        if (unwrapped === null) return null;
        const element = this.collectType(unwrapped.type, ctx);
        if (element == null) return null;
        return element;
      }
      default: {
        // We may not have encountered the definition of this type yet. So, we
        // mark it as unresolved and return a placeholder type.
        //
        // A later pass will resolve the type.
        const namedType = this.gql.namedType(node, UNRESOLVED_REFERENCE_NAME);
        this.markUnresolvedType(node.typeName, namedType.name);
        return this.gql.nonNullType(node, namedType);
      }
    }
  }

  isNullish(node: ts.Node): boolean {
    if (ts.isIdentifier(node)) {
      return node.escapedText === "undefined";
    }
    if (ts.isLiteralTypeNode(node)) {
      return (
        node.literal.kind === ts.SyntaxKind.NullKeyword ||
        node.literal.kind === ts.SyntaxKind.UndefinedKeyword
      );
    }
    return (
      node.kind === ts.SyntaxKind.NullKeyword ||
      node.kind === ts.SyntaxKind.UndefinedKeyword ||
      node.kind === ts.SyntaxKind.VoidKeyword
    );
  }

  expectNameIdentifier(node: ts.Node): ts.Identifier | null {
    if (ts.isIdentifier(node)) {
      return node;
    }
    return this.report(node, E.expectedNameIdentifier());
  }

  findTag(node: ts.Node, tagName: string): ts.JSDocTag | null {
    const tags = ts
      .getJSDocTags(node)
      .filter((tag) => tag.tagName.escapedText === tagName);

    if (tags.length === 0) {
      return null;
    }
    if (tags.length > 1) {
      const additionalTags = tags.slice(1).map((tag) => {
        return tsRelated(tag, "Additional tag");
      });

      return this.report(tags[0], E.duplicateTag(tagName), additionalTags, {
        fixName: "remove-duplicate-tag",
        description: `Remove duplicate @${tagName} tag`,
        changes: tags.slice(1).map((tag) => Act.removeNode(tag)), // Remove all but the first tag
      });
    }
    return tags[0];
  }

  hasTag(node: ts.Node, tagName: string): boolean {
    const tags = ts
      .getJSDocTags(node)
      .filter((tag) => tag.tagName.escapedText === tagName);

    return tags.length > 0;
  }

  // It is a GraphQL best practice to model all fields as nullable. This allows
  // the server to handle field level executions by simply returning null for
  // that field.
  // https://graphql.org/learn/best-practices/#nullability
  killsParentOnException(parentNode: ts.Node): NameNode | null {
    const tags = ts.getJSDocTags(parentNode);
    const killsParentOnExceptions = tags.find(
      (tag) => tag.tagName.text === KILLS_PARENT_ON_EXCEPTION_TAG,
    );
    if (killsParentOnExceptions) {
      return this.gql.name(
        killsParentOnExceptions.tagName,
        KILLS_PARENT_ON_EXCEPTION_TAG,
      );
    }
    return null;
  }
}

function graphQLNameValidationMessage(name: string): string | null {
  try {
    assertName(name);
    return null;
  } catch (e) {
    return e.message;
  }
}

// Trims any number of whitespace-only lines including any lines that simply
// contain a `*` surrounded by whitespace.
function trimTrailingCommentLines(text: string) {
  return text.replace(/(\s*\n\s*\*?\s*)+$/, "");
}

function isCallable(
  node: ts.MethodDeclaration | ts.MethodSignature | ts.GetAccessorDeclaration,
): boolean {
  return ts.isMethodDeclaration(node) || ts.isMethodSignature(node);
}

function isStaticMethod(node: ts.Node): node is ts.MethodDeclaration {
  return (
    ts.isMethodDeclaration(node) &&
    node.modifiers != null &&
    node.modifiers.some(
      (modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword,
    )
  );
}

// Given a node annotated as @gqlField, finds the parent node that is
// expected to be annotated with @gqlType or @gqlInterface.
//
// Note that this is basically a reverse encoding of the traversal
// we do from the @gqlType or @gqlInterface node to the fields.
// This code needs to stay in sync with the traversal code, but should do so
// safely since, if it doesn't match we'd end up with test errors.
function getFieldParent(node: ts.Node): ts.Node | null {
  if (
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isPropertyDeclaration(node)
  ) {
    return node.parent;
  } else if (ts.isParameter(node)) {
    if (ts.isConstructorDeclaration(node.parent)) {
      return node.parent.parent;
    }
    return null;
  } else if (ts.isPropertySignature(node) || ts.isMethodSignature(node)) {
    if (
      ts.isTypeLiteralNode(node.parent) &&
      ts.isTypeAliasDeclaration(node.parent.parent)
    ) {
      return node.parent.parent;
    } else if (ts.isInterfaceDeclaration(node.parent)) {
      return node.parent;
    }
    return null;
  }

  return null;
}
