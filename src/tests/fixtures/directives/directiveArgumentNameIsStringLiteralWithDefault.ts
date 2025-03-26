// https://github.com/captbaritone/grats/issues/166#issuecomment-2753130827

/**
 * @gqlDirective on FRAGMENT_SPREAD | INLINE_FRAGMENT
 */
function defer({
  label,
  if: _ = true, // anonymous alias
}: {
  label: string;
  if?: boolean | null;
}): void {}
