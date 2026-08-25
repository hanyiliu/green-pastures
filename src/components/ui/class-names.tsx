/**
 * The `className` contract every primitive in 04 §3.2 keeps.
 *
 * **The problem this exists to solve.** Tailwind v4 puts utilities in
 * `@layer utilities` and sorts that layer by the property each one writes, so
 * the order class names appear in on an element decides nothing — the cascade
 * takes the rule that comes later *in the stylesheet*. Appending the caller's
 * classes to the recipe, which is what all nine primitives used to do, looks
 * like an override and is not: the built stylesheet emits `.bg-white` before
 * `.bg-yelp-pill-bg`, so `<Chip tone="gold" className="bg-white">` stayed gold.
 *
 * **The contract.**
 *
 * 1. `className` is appended to the recipe, so a class that sets a property the
 *    recipe leaves alone — `mt-2`, `self-start`, `absolute` — simply applies.
 * 2. To change a property the recipe *does* set, mark the class important:
 *    `bg-white!`, `md:px-0!`. Tailwind compiles the modifier to `!important`,
 *    which outranks the recipe wherever the two rules land in the stylesheet,
 *    and it does so one property at a time — `text-center!` retargets
 *    `text-align` and leaves the recipe's `text-chip` font size standing.
 * 3. A caller class that collides with the recipe and is *not* important is a
 *    defect, and {@link withOverrides} throws on it. That is the whole point:
 *    the failure it replaces was silent, and a prop that looks like an override
 *    while quietly doing nothing is worse than either honest answer.
 *
 * **What the collision check knows.** It reads the recipe string it is handed —
 * no hand-kept list of the recipes goes stale — and buckets both sides by the
 * property a utility writes, keyed per variant so `md:px-6` and `px-4` are
 * separate claims. The buckets are deliberately coarse: every `text-*` utility
 * shares one bucket, as does every `font-*`. Coarse errs toward *demanding* the
 * important marker on a class that would have been harmless, and the marker is
 * harmless in turn, because `!important` is property-scoped. Erring the other
 * way — dropping a recipe class the caller never meant to replace — is the
 * failure mode this file exists to remove, so it is never taken.
 *
 * **Where the two tables come from.** Not from memory. `tests/unit/components/
 * class-names.test.tsx` walks Tailwind's own design system, asks the compiler
 * what every utility in the vocabulary writes, and fails if two of them write
 * the same property from buckets that do not meet. Written from memory, the
 * tables missed `tabular-nums` against `proportional-nums` — both
 * `font-variant-numeric`, bucketed `tabular` and `proportional`, no collision
 * seen — and twenty-odd other families with it. The named entries below are
 * exactly what that sweep demands; the first-segment fallback carries the rest.
 *
 * **What is not a collision.** Tailwind composes several utilities onto one
 * property through `--tw-*` slots: `text-sm` writes
 * `line-height: var(--tw-leading, …)` and `leading-none` writes `--tw-leading`,
 * so the pair cooperates and must *not* be refused. The sweep knows the
 * difference by reading each value's variable references, which is why `text-*`
 * and `leading-*` stay separate buckets while `tabular-nums` and
 * `proportional-nums` — one slot, two writers — become one.
 */

const PADDING = ["pad-t", "pad-r", "pad-b", "pad-l"] as const;
const MARGIN = ["mar-t", "mar-r", "mar-b", "mar-l"] as const;
const CORNERS = ["round-tl", "round-tr", "round-br", "round-bl"] as const;

/**
 * `sr-only` is nine properties at once, which is why it cannot be left to the
 * fallback: bucketed `sr`, it collided with nothing at all. `not-sr-only` is
 * the same list without the border width it has no need to reset.
 */
const NOT_SR_ONLY = [
  "position",
  "width",
  "height",
  ...PADDING,
  ...MARGIN,
  "overflow",
  "whitespace",
] as const;
const SR_ONLY = [...NOT_SR_ONLY, "border"] as const;

/**
 * The five slots `font-variant-numeric` composes from. Two utilities that write
 * *the same* slot fight; two that write different slots cooperate, which is the
 * whole reason this property gets five buckets rather than one.
 */
const NUMERIC = [
  "numeric-ordinal",
  "numeric-slashed",
  "numeric-figure",
  "numeric-spacing",
  "numeric-fraction",
] as const;

/**
 * Utilities that carry no value, by the properties they write. Checked before
 * the prefix table so `flex` (a display) never reads as `flex-1`'s bucket, and
 * so `flex-col` (a direction) does not either.
 *
 * A few write more than one property, which is the reason the value is a list:
 * `truncate` is three, `container` is two, `sr-only` is nine.
 */
const BARE: Readonly<Record<string, readonly string[]>> = {
  block: ["display"],
  "inline-block": ["display"],
  inline: ["display"],
  flex: ["display"],
  "inline-flex": ["display"],
  grid: ["display"],
  "inline-grid": ["display"],
  table: ["display"],
  "inline-table": ["display"],
  "table-caption": ["display"],
  "table-cell": ["display"],
  "table-column": ["display"],
  "table-column-group": ["display"],
  "table-footer-group": ["display"],
  "table-header-group": ["display"],
  "table-row": ["display"],
  "table-row-group": ["display"],
  "flow-root": ["display"],
  contents: ["display"],
  "list-item": ["display"],
  hidden: ["display"],
  static: ["position"],
  fixed: ["position"],
  absolute: ["position"],
  relative: ["position"],
  sticky: ["position"],
  uppercase: ["text-transform"],
  lowercase: ["text-transform"],
  capitalize: ["text-transform"],
  "normal-case": ["text-transform"],
  italic: ["font-style"],
  "not-italic": ["font-style"],
  underline: ["text-decoration"],
  overline: ["text-decoration"],
  "line-through": ["text-decoration"],
  "no-underline": ["text-decoration"],
  visible: ["visibility"],
  invisible: ["visibility"],
  collapse: ["visibility"],
  isolate: ["isolation"],
  "isolation-auto": ["isolation"],
  antialiased: ["font-smoothing"],
  "subpixel-antialiased": ["font-smoothing"],
  // `flex-*` is three properties wearing one prefix: a direction, a wrap, and
  // the `flex` shorthand that `flex-1` writes. Only the last belongs to the
  // prefix table, so the other two are named here.
  "flex-row": ["flex-direction"],
  "flex-row-reverse": ["flex-direction"],
  "flex-col": ["flex-direction"],
  "flex-col-reverse": ["flex-direction"],
  "flex-wrap": ["flex-wrap"],
  "flex-wrap-reverse": ["flex-wrap"],
  "flex-nowrap": ["flex-wrap"],
  // `overflow-wrap` is written by both the `break-*` and the `wrap-*` families.
  "wrap-normal": ["break"],
  "wrap-break-word": ["break"],
  "wrap-anywhere": ["break"],
  // `truncate` is `overflow` + `text-overflow` + `white-space`, so it has to
  // reach into all three families' buckets; `text-clip` and `text-ellipsis`
  // keep the coarse `text` bucket as well as the precise one.
  truncate: ["overflow", "whitespace", "text-overflow"],
  "text-clip": ["text", "text-overflow"],
  "text-ellipsis": ["text", "text-overflow"],
  container: ["width", "max-width"],
  // `transform`, `transform-gpu` and `transform-cpu` compose with `rotate-x-*`
  // and `skew-*` through their `--tw-*` slots. `transform-none` does not — it
  // writes the property outright — so it alone claims their buckets.
  "transform-none": ["transform", "rotate", "skew"],
  ordinal: ["numeric-ordinal"],
  "slashed-zero": ["numeric-slashed"],
  "lining-nums": ["numeric-figure"],
  "oldstyle-nums": ["numeric-figure"],
  "proportional-nums": ["numeric-spacing"],
  "tabular-nums": ["numeric-spacing"],
  "diagonal-fractions": ["numeric-fraction"],
  "stacked-fractions": ["numeric-fraction"],
  "normal-nums": NUMERIC,
  "sr-only": SR_ONLY,
  "not-sr-only": NOT_SR_ONLY,
};

/**
 * Prefixes whose bucket is not simply their first segment — the shorthands that
 * write several properties at once (`p-4` covers `px-4`), the two-segment names
 * whose first segment would collapse unrelated properties (`min-w` and `min-h`
 * are not one bucket), and the logical-property spellings Tailwind v4 added,
 * which write the same edges as the physical ones under a different first
 * segment (`mbs-2` is `mt-2`'s property). Longest prefix wins, so the order
 * here is only for reading; {@link PREFIX_ENTRIES} sorts by length.
 */
const PREFIXES: Readonly<Record<string, readonly string[]>> = {
  p: PADDING,
  px: ["pad-l", "pad-r"],
  py: ["pad-t", "pad-b"],
  ps: ["pad-l"],
  pe: ["pad-r"],
  pt: ["pad-t"],
  pr: ["pad-r"],
  pb: ["pad-b"],
  pl: ["pad-l"],
  pbs: ["pad-t"],
  pbe: ["pad-b"],
  m: MARGIN,
  mx: ["mar-l", "mar-r"],
  my: ["mar-t", "mar-b"],
  ms: ["mar-l"],
  me: ["mar-r"],
  mt: ["mar-t"],
  mr: ["mar-r"],
  mb: ["mar-b"],
  ml: ["mar-l"],
  mbs: ["mar-t"],
  mbe: ["mar-b"],
  size: ["width", "height"],
  w: ["width"],
  h: ["height"],
  inline: ["width"],
  block: ["height"],
  "min-w": ["min-width"],
  "min-h": ["min-height"],
  "max-w": ["max-width"],
  "max-h": ["max-height"],
  "min-inline": ["min-width"],
  "min-block": ["min-height"],
  "max-inline": ["max-width"],
  "max-block": ["max-height"],
  gap: ["gap-x", "gap-y"],
  "gap-x": ["gap-x"],
  "gap-y": ["gap-y"],
  rounded: CORNERS,
  "rounded-t": ["round-tl", "round-tr"],
  "rounded-r": ["round-tr", "round-br"],
  "rounded-b": ["round-bl", "round-br"],
  "rounded-l": ["round-tl", "round-bl"],
  "rounded-s": ["round-tl", "round-bl"],
  "rounded-e": ["round-tr", "round-br"],
  "rounded-tl": ["round-tl"],
  "rounded-tr": ["round-tr"],
  "rounded-br": ["round-br"],
  "rounded-bl": ["round-bl"],
  translate: ["translate-x", "translate-y"],
  "translate-x": ["translate-x"],
  "translate-y": ["translate-y"],
  inset: ["top", "right", "bottom", "left"],
  "inset-x": ["left", "right"],
  "inset-y": ["top", "bottom"],
  start: ["left"],
  end: ["right"],
  "space-x": ["space-x"],
  "space-y": ["space-y"],
  // `flex-1` writes the `flex` shorthand, which is `grow` + `shrink` + `basis`.
  // The direction and wrap spellings are in {@link BARE}, ahead of this.
  flex: ["grow", "shrink", "basis"],
  // Each `place-*` is two properties: its own axis pair, and `justify-*`, whose
  // one coarse bucket already covers content, items and self alike.
  "place-content": ["content", "justify"],
  "place-items": ["items", "justify"],
  "place-self": ["self", "justify"],
  // `line-clamp-*` is a display and an overflow before it is a line count.
  "line-clamp": ["display", "overflow", "line-clamp"],
};

/** {@link PREFIXES} longest name first, so `min-w` is tried before `min`. */
const PREFIX_ENTRIES: readonly (readonly [string, readonly string[]])[] = Object.entries(
  PREFIXES,
).sort(([left], [right]) => right.length - left.length);

/** The classes in a class attribute, with the runs of whitespace dropped. */
export function classList(value: string | undefined): readonly string[] {
  return (value ?? "").split(/\s+/u).filter((entry) => entry.length > 0);
}

/**
 * Splits a class into its variant prefix and the utility it decorates, ignoring
 * the `:` inside an arbitrary value (`[&:hover]:…`, `text-(color:--x)`).
 */
function splitVariants(className: string): { readonly variants: string; readonly utility: string } {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < className.length; index += 1) {
    const character = className.charAt(index);
    if (character === "[" || character === "(") depth += 1;
    else if (character === "]" || character === ")") depth -= 1;
    else if (character === ":" && depth === 0) {
      parts.push(className.slice(start, index));
      start = index + 1;
    }
  }

  return { variants: parts.join(":"), utility: className.slice(start) };
}

/** Tailwind v4 marks a utility important with a trailing `!`; v3 used a leading one. */
function isImportant(utility: string): boolean {
  return utility.startsWith("!") || utility.endsWith("!");
}

function stripModifiers(utility: string): string {
  const withoutImportant = utility.replace(/^!/u, "").replace(/!$/u, "");
  return withoutImportant.replace(/^-/u, "");
}

/**
 * The properties a class claims, one bucket each, namespaced by the class's
 * variants so `md:px-6` never collides with `px-4`.
 *
 * Exported for the vocabulary sweep in `class-names.test.tsx`, which walks
 * every utility Tailwind knows and fails on any two that write one property
 * from buckets that never meet. Nothing in `src/` calls it but
 * {@link withOverrides}.
 */
export function bucketsOf(className: string): readonly string[] {
  const { variants, utility } = splitVariants(className);
  const bare = stripModifiers(utility);

  const named = BARE[bare];
  if (named !== undefined) return named.map((bucket) => `${variants}|${bucket}`);

  for (const [prefix, buckets] of PREFIX_ENTRIES) {
    if (bare === prefix || bare.startsWith(`${prefix}-`)) {
      return buckets.map((bucket) => `${variants}|${bucket}`);
    }
  }

  // Anything the table does not name buckets by its first segment, which is
  // right for the whole `text-*` / `bg-*` / `shadow-*` shape of the vocabulary.
  return [`${variants}|${bare.replace(/-.*$/su, "")}`];
}

/**
 * Joins a primitive's recipe to the caller's `className`, refusing a caller
 * class that would silently lose to the recipe.
 *
 * @param component  The primitive's name, so the error names the call site.
 * @param recipe     The recipe classes, in any order.
 * @param className  The caller's classes, or `undefined`.
 * @throws If a caller class claims a property the recipe already claims and is
 *   not marked important — the case Tailwind's layer order would decide against
 *   the caller. The message carries the fix.
 */
export function withOverrides(component: string, recipe: string, className?: string): string {
  const callerClasses = classList(className);
  const recipeClasses = classList(recipe);

  if (callerClasses.length > 0) {
    const claimed = new Map<string, string>();
    for (const owned of recipeClasses) {
      for (const bucket of bucketsOf(owned)) claimed.set(bucket, owned);
    }

    for (const candidate of callerClasses) {
      if (isImportant(splitVariants(candidate).utility)) continue;

      for (const bucket of bucketsOf(candidate)) {
        const collision = claimed.get(bucket);
        if (collision === undefined) continue;

        throw new Error(
          `${component} was given the class "${candidate}", which sets a property its own ` +
            `recipe already sets ("${collision}"). Tailwind sorts utilities by property, so a ` +
            `class appended to the attribute does not win — mark the override important ` +
            `("${candidate}!"), or add a variant to the recipe if every caller wants it ` +
            `(04 §3.2).`,
        );
      }
    }
  }

  return [...recipeClasses, ...callerClasses].join(" ");
}
