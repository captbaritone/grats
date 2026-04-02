// trim-start
type AdminToken = "AdminToken" & { __brand: "AdminToken" };
type AssertAdminToken = AdminToken;

/** @gqlContext */
type Ctx = {
  isAdmin: true;
};

/** @gqlContext */
export function adminCheck(ctx: Ctx): AssertAdminToken {
  if (!ctx.isAdmin) {
    throw new Error("You do not have permission to access this field");
  }
  return "AdminToken" as AdminToken;
}

// trim-end
/**
 * This field will throw for any user that is not an admin. This is enabled
 * simply by adding an argument typed as `AssertAdminToken`, even if it's
 * unused.
 *
 * @gqlQueryField */
export function someField(_admin: AssertAdminToken): string {
  return "You must be an admin!";
}
