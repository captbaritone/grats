import {
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLSchema,
  Location,
} from "graphql";
import { Result, err, ok } from "./utils/Result";
import { nullThrows } from "./utils/helpers";

type EntityName = {
  parent: string;
  field: string | null;
};

/**
 * Given an entity name of the format `ParentType` or `ParentType.fieldName`,
 * locate the entity in the schema and return its location.
 */
export function locate(
  schema: GraphQLSchema,
  entityName: string,
): Result<Location, string> {
  const entityResult = parseEntityName(entityName);
  if (entityResult.kind === "ERROR") {
    return entityResult;
  }
  const entity = entityResult.value;
  const type = schema.getType(entity.parent);
  if (type == null) {
    return err(`Cannot locate type \`${entity.parent}\`.`);
  }
  if (entity.field == null) {
    if (type.astNode == null) {
      throw new Error(
        `Grats bug: Cannot find location of type \`${entity.parent}\`.`,
      );
    }
    return ok(nullThrows(type.astNode.name.loc));
  }

  if (
    !(
      type instanceof GraphQLObjectType ||
      type instanceof GraphQLInterfaceType ||
      type instanceof GraphQLInputObjectType
    )
  ) {
    return err(
      `Cannot locate field \`${entity.field}\` on type \`${entity.parent}\`. Only object types, interfaces, and input objects have fields.`,
    );
  }

  const field = type.getFields()[entity.field];
  if (field == null) {
    return err(
      `Cannot locate field \`${entity.field}\` on type \`${entity.parent}\`.`,
    );
  }

  if (field.astNode == null) {
    throw new Error(
      `Grats bug: Cannot find location of field \`${entity.field}\` on type \`${entity.parent}\`.`,
    );
  }
  return ok(nullThrows(field.astNode.name.loc));
}

const ENTITY_NAME_REGEX = /^([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?$/;

function parseEntityName(entityName: string): Result<EntityName, string> {
  const match = ENTITY_NAME_REGEX.exec(entityName);
  if (match == null) {
    return err(
      `Invalid entity name: \`${entityName}\`. Expected \`ParentType\` or \`ParentType.fieldName\`.`,
    );
  }
  const parent = match[1];
  const field = match[2] || null;
  return ok({ parent, field });
}
