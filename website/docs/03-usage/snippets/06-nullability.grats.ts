/** @gqlType */
class MyType {
  /**
   * @gqlField
   * @killsParentOnException
   */
  myField(): string {
    if (Math.random() > 0.5) {
      throw new Error("Bang");
    }
    return "Whew!";
  }
}
