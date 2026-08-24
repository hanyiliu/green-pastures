import { RevealItem } from "@/components/motion/Reveal";
import { Emoji } from "@/components/ui/Emoji";

import { PRINCIPLE_BODY, PRINCIPLE_CARD, PRINCIPLE_TILE, PRINCIPLE_TITLE } from "./layout";

/**
 * One principle (04 §3.6; D L360–L363, M L268–L271).
 *
 * A tinted emoji tile, a Fredoka title and a line of body copy, in a white
 * card. It is one `<li>` of {@link PrinciplesList}'s list and one staggered
 * child of that list's `Reveal`, 110 ms behind the card before it (05 §5.3).
 *
 * **The tile is `Emoji`, not `IconDot`.** 04 §3.2 names an `IconDot` primitive
 * and 04 §2 records it as not built; `Emoji size="tile"` is the built recipe
 * for exactly this box (its own docstring says "the principle tiles"), so this
 * card binds that rather than adding a ninth spelling of a centred glyph. The
 * glyph is decorative — the title beside it says everything the pictogram says
 * — so it carries no `label` and renders `aria-hidden` (03 `D-03.8`).
 *
 * Which glyph belongs to which principle is `site.json` data
 * (`principles[].icon`), never a test on the id: a daycare that swaps 🏡 for
 * 🌳 edits content and nothing here moves.
 */

export type PrincipleCardProps = {
  /** `site.principles[].icon` — the tile's glyph. */
  readonly icon: string;
  /** `philosophy.principles.<id>.title`, resolved by the list. */
  readonly title: string;
  /** `philosophy.principles.<id>.body`, resolved by the list. */
  readonly body: string;
};

export function PrincipleCard({ icon, title, body }: PrincipleCardProps) {
  return (
    <RevealItem variant="riseChild" as="li" className={PRINCIPLE_CARD}>
      <Emoji symbol={icon} size="tile" className={PRINCIPLE_TILE} />
      <h3 className={PRINCIPLE_TITLE}>{title}</h3>
      <p className={PRINCIPLE_BODY}>{body}</p>
    </RevealItem>
  );
}
