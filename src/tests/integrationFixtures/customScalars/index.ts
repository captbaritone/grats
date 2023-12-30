import { Maybe } from "@graphql-tools/utils";
import { ValueNode } from "graphql";
import { ObjMap } from "graphql/jsutils/ObjMap";

/** @gqlType */
type Query = unknown;

/**
 * @gqlScalar
 */
export type DateTime = Date;

/**
 * @gqlField
 */
export function echo(_: Query, args: { in: DateTime }): DateTime {
  return args.in;
}

/**
 * @gqlField
 */
export function now(_: Query): DateTime {
  return new Date();
}

export const config = {
  scalars: {
    DateTime: {
      serialize: (value: DateTime): number => value.getTime(),
      parseValue(value: unknown): DateTime {
        if (typeof value !== "number") throw new Error("Date is not a number");
        return new Date(value);
      },
      parseLiteral(
        ast: ValueNode,
        _variables?: Maybe<ObjMap<unknown>>,
      ): DateTime {
        if (ast.kind !== "IntValue") throw new Error("Date is not IntValue");
        return new Date(ast.value);
      },
    },
  },
};

export const query = `
    query SomeQuery($in: DateTime!) {
      echo(in: 1703926606365)
      echoVar: echo(in: $in)
      now
    }
  `;

export const variables = {
  in: 1703926606365,
};
