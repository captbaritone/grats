/**
 * Generic model class built around a database row
 */
export abstract class Model<R extends { id: string }> {
  constructor(protected row: R) {}
  localID(): string {
    return this.row.id;
  }
}
