import type { ReactNode } from "react";

import { getSite } from "@/content/site";
import { Link } from "@/i18n/navigation";

/**
 * The "learn more →" link that closes most home sections (04 §3.2).
 *
 * The caller names a route id, not a path: the target is resolved through
 * `site.routes[]` (02 `D-02.12`), so a route move is a `content/site.json` edit
 * and nothing else. The label — arrow included — arrives as `children` from
 * `home.<section>.link`; the `→` lives inside the translated string (02 §5.4),
 * so no glyph is appended here.
 *
 * Colour and underline come from the section role variables `--section-link`
 * and `--section-link-underline` (`D-04.3`), never from a per-section colour
 * name. `--text-blurb` is the type token whose two values (13px `< md`, 15px
 * `≥ md`) are exactly the design's link sizes — there is no `--text-link` in
 * 03 §3.2.
 *
 * **Hit area.** The design draws a 2px underline hugging the text with 2px of
 * clearance, which a 44px-tall box would pull away from the words. So the
 * anchor is the 44px target (`min-h-(--tap-min)`, INV-04.7) and the rule sits
 * on an inner span, leaving the drawn link unchanged.
 */

export type LearnMoreLinkProps = {
  /** An `id` from `site.routes[]` — `philosophy`, `programs`, `reviews`, `team`, … */
  readonly routeId: string;
  /** The whole label, arrow included, from `home.<section>.link`. */
  readonly children: ReactNode;
  readonly className?: string;
};

export function LearnMoreLink({ routeId, children, className }: LearnMoreLinkProps) {
  const route = getSite().routes.find((entry) => entry.id === routeId);

  if (route === undefined) {
    throw new Error(
      `LearnMoreLink was given the route id "${routeId}", which content/site.json does not ` +
        `declare in routes[] (02 D-02.12).`,
    );
  }

  return (
    <Link
      href={route.path}
      transitionTypes={["subpage-enter"]}
      className={`inline-flex min-h-(--tap-min) items-center font-body text-blurb font-bold text-(color:--section-link) ${className ?? ""}`}
    >
      <span className="border-b-2 border-(color:--section-link-underline) pb-0.5">{children}</span>
    </Link>
  );
}
