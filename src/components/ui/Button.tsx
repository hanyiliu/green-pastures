import type { ComponentProps, ReactNode } from "react";

import { Link } from "@/i18n/navigation";

/**
 * The pill button (04 §3.2): `--radius-pill`, a `--shadow-primary*` family
 * shadow, the desktop-only hover lift of 05 §5.10, and a hit area that is never
 * below `--tap-min` (INV-04.7).
 *
 * It renders either an internal link (next-intl `Link`, INV-02.7) or a real
 * `<button>`. It carries no `onClick`: the analytics wrapper is `TrackedLink`
 * (`D-04.1`), and this recipe stays a server component so its label can be
 * server-rendered copy. {@link buttonRecipe} is exported for exactly that —
 * `BookTourButton` puts the pill styling on a `TrackedLink` without a second
 * copy of the recipe.
 *
 * **Known token gap (03 §3.2).** `--text-button` carries the *nav* pill's value
 * (13px `< md`, 16px `≥ md`); the row's other two values — hero 17/18px and
 * submit 16/17px — are written in 03 §3.2 as prose beside it and were never
 * minted as tokens, so `src/styles/tokens.css` has nothing else to name. Every
 * size below therefore renders at `--text-button` until 03 mints
 * `--text-button-hero` / `--text-button-submit`; inventing a px here would
 * break INV-03.2 and INV-03.5.
 */

/**
 * Padding and width per placement, from `docs/design/desktop/README.md`
 * ("Layout", §1) and `docs/design/mobile/README.md` ("Layout", §1). All values
 * are Tailwind's `--spacing` scale, not raw px: `py-2.5` is 10px, `px-6` 24px,
 * `py-3.75` 15px, `px-7.5` 30px.
 */
const SIZE = {
  /** Nav pill — `10×16` mobile, `12×24` desktop. */
  nav: "px-4 py-2.5 md:px-6 md:py-3",
  /** Hero CTA — full width mobile with 15px vertical, `15×32` desktop. */
  hero: "w-full px-8 py-3.75 md:w-auto",
  /** Form submit — full width mobile with 15px vertical, `14×30` desktop. */
  submit: "w-full px-8 py-3.75 md:w-auto md:px-7.5 md:py-3.5",
} as const;

/** The resting shadow of the sage pill, which is per placement (03 §5). */
const SIZE_SHADOW = {
  nav: "shadow-primary-sm hover:shadow-primary",
  hero: "shadow-primary",
  submit: "shadow-submit",
} as const;

const TONE = {
  /** The brand pill: sage fill, white label, Fredoka 500 (design L69, L105, L119). */
  sage: "font-display bg-sage font-medium text-white",
  /** The Yelp pill: Yelp red, white label, Nunito 700 (design L544). */
  yelp: "font-body bg-yelp font-bold text-white shadow-yelp",
} as const;

export type ButtonSize = keyof typeof SIZE;
export type ButtonTone = keyof typeof TONE;

/**
 * The pill recipe as a class string, so a client wrapper (`TrackedLink`) can
 * wear it without importing this component.
 *
 * The hover lift is 05 §5.10 / `D-05.12`: `translateY(-1px)` plus a deeper
 * shadow, transitioned over `--dur-word-swap` because the design gives no hover
 * duration and 05 chose to reuse that token rather than mint a number. Tailwind
 * gates `hover:` behind `@media (hover: hover)`, and `motion-reduce:` drops the
 * transform so reduced motion keeps colour and shadow only.
 */
export function buttonRecipe(size: ButtonSize, tone: ButtonTone): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-pill",
    "min-h-(--tap-min) min-w-(--tap-min) text-center text-button",
    "transition duration-(--dur-word-swap) ease-soft",
    "hover:-translate-y-px motion-reduce:hover:translate-y-0",
    SIZE[size],
    tone === "sage" ? SIZE_SHADOW[size] : "",
    TONE[tone],
  ].join(" ");
}

type ButtonBaseProps = {
  readonly children: ReactNode;
  readonly size?: ButtonSize;
  readonly tone?: ButtonTone;
  readonly className?: string;
};

export type ButtonProps = ButtonBaseProps &
  (
    | { readonly as?: "link"; readonly href: ComponentProps<typeof Link>["href"] }
    | { readonly as: "button"; readonly type?: "button" | "submit" }
  );

export function Button({ children, size = "nav", tone = "sage", className, ...rest }: ButtonProps) {
  const classes = `${buttonRecipe(size, tone)} ${className ?? ""}`;

  if (rest.as === "button") {
    return (
      <button type={rest.type ?? "button"} className={classes}>
        {children}
      </button>
    );
  }

  return (
    <Link href={rest.href} className={classes}>
      {children}
    </Link>
  );
}
