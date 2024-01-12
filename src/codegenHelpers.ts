import * as ts from "typescript";

export const ASSERT_NON_NULL_HELPER = "assertNonNull";
const F = ts.factory;

/**
 * async function assertNonNull<T>(value: T | Promise<T>): Promise<T> {
 *   const awaited = await value;
 *   if (awaited == null)
 *     throw new Error("Cannot return null for semantically non-nullable field.");
 *   return awaited;
 * }
 */
export function createAssertNonNullHelper(): ts.FunctionDeclaration {
  const argName = "value";
  const awaited = "awaited";
  const t = "T";
  const tReference = F.createTypeReferenceNode("T");
  const promiseT = F.createTypeReferenceNode("Promise", [tReference]);

  const typeParam = F.createUnionTypeNode([tReference, promiseT]);

  return F.createFunctionDeclaration(
    [F.createModifier(ts.SyntaxKind.AsyncKeyword)],
    undefined,
    ASSERT_NON_NULL_HELPER,
    [F.createTypeParameterDeclaration(undefined, t)],
    [
      F.createParameterDeclaration(
        undefined,
        undefined,
        argName,
        undefined,
        typeParam,
        undefined,
      ),
    ],
    promiseT,
    F.createBlock(
      [
        F.createVariableStatement(
          undefined,
          F.createVariableDeclarationList(
            [
              F.createVariableDeclaration(
                awaited,
                undefined,
                undefined,
                F.createAwaitExpression(F.createIdentifier(argName)),
              ),
            ],
            ts.NodeFlags.Const,
          ),
        ),
        F.createIfStatement(
          F.createEquality(F.createIdentifier(awaited), F.createNull()),
          F.createThrowStatement(
            F.createNewExpression(F.createIdentifier("Error"), undefined, [
              F.createStringLiteral(
                "Cannot return null for semantically non-nullable field.",
              ),
            ]),
          ),
        ),
        F.createReturnStatement(F.createIdentifier(awaited)),
      ],
      true,
    ),
  );
}
