import { VC } from "../ViewerContext.js";

/**
 * Generic model class built around a database row
 */
export abstract class Model<R extends { id: string }> {
  constructor(
    protected vc: VC,
    protected row: R,
  ) {}
  localID(): string {
    return this.row.id;
  }
}
