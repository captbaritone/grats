// trim-start
type AdminToken = "AdminToken" & { __brand: "AdminToken" };

/**
 * @gqlContext
 */
type Ctx = {
  isAdmin: boolean;
};

// trim-end
type MaybeAdminToken = AdminToken | null;

/**
 * @gqlContext
 */
export function maybeAdminToken(ctx: Ctx): MaybeAdminToken {
  if (ctx.isAdmin) {
    return "AdminToken" as AdminToken;
  }
  return null;
}

/** @gqlQueryField */
export function someField(admin: MaybeAdminToken): string | null {
  // TypeScript ensures we somehow handle the case where `admin` is null before
  // calling into the data layer.
  if (admin == null) {
    return null;
  }
  return someDataLayerFunction(admin);
}

function someDataLayerFunction(_admin: AdminToken) {
  return "Here is your data";
}
