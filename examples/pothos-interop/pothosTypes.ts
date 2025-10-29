import IPersonInternal from "./interfaces/IPerson";
import GroupInternal from "./models/Group";
import UserInternal from "./models/User";

type EnsureSubtype<T extends Partial<PothosSchemaTypes.UserSchemaTypes>> = T;

export type PothosUserSchemaTypes = EnsureSubtype<{
  Defaults: "v4";
  Objects: {
    Group: GroupInternal;
    User: UserInternal;
  };
  Interface: {
    IPerson: IPersonInternal;
  };
  DefaultFieldNullability: true;
}>;
