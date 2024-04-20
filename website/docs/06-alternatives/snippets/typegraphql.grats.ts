import { Float, Int } from "grats";

/** @gqlType */
class Recipe {
  /** @gqlField */
  title: string;

  /** @gqlField */
  description?: string;

  /** @gqlField */
  ratings: Float[];

  /** @gqlField */
  get averageRating(): Float | null {
    const sum = this.ratings.reduce((a, b) => a + b, 0);
    return sum / this.ratings.length;
  }
}
