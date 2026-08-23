import { Chip } from "@/components/ui/Chip";
import type { DietaryEntry } from "@/content/collections";

import { DIETARY_CHIP, DIETARY_LABEL, DIETARY_ROW } from "./layout";

/**
 * "🥦 Vegetarian options daily", "🌾 Allergy-aware kitchen" (04 §4's
 * `DietaryChips` row; D L208–210, M L137–139).
 *
 * ── The list is what the caller hands it ─────────────────────────────────
 *
 * `site.menu.dietary[]` carries three chips with an `onHome` flag, and 04 §4
 * reads it as "home shows `onHome` (2), page shows all (3)". The filtering is
 * the *caller's*, not this component's, which is what lets PR-6.4's menu page
 * reuse the same file for all three without a `surface` branch here.
 *
 * ── No `icon`, and that is 02's decision ─────────────────────────────────
 *
 * The emoji is inside the label string (02 `D-02.5`: "chip emoji lives in the
 * label text"), so `site.menu.dietary[]` has no `icon` field and there is no
 * `Emoji` child. The emoji translates with the words — 🥦 for vegetables, 🌾 for
 * grain — and a locale that wanted a different one edits its own JSON.
 *
 * ── Two labels, one `<li>` (`D-04.5`) ────────────────────────────────────
 *
 * Both the long and the short label render and `md:` picks one, so no view is a
 * branch in code (INV-04.4). They share an `<li>` rather than getting one each,
 * so the list is as long as `dietary[]` says it is however wide the window is.
 * A locale that supplies no `labelShort` gets one unconditional chip.
 *
 * ── What the chips render at ─────────────────────────────────────────────
 *
 * `Chip tone="white"` is the design's recipe for this row — white fill,
 * `--section-sub` ink, `--shadow-chip-gold-md` (D L209) — but `Chip` hard-codes
 * one size and one padding across all six of its tones, so the two tokens 03
 * mints for *this* role are overridden back in from `layout.ts`:
 * `--text-chip-benefit` (11px → 12px) and `--chip-benefit` (7×12 → 8×14). See
 * {@link DIETARY_CHIP} for why important is both required and sufficient.
 */

export type DietaryChipsProps = {
  /** Already filtered by the caller — `onHome` on the home page, all three on the page. */
  readonly items: readonly DietaryEntry[];
};

export function DietaryChips({ items }: DietaryChipsProps) {
  return (
    <ul className={DIETARY_ROW}>
      {items.map((item) => {
        const short = item.text.labelShort;

        return (
          <li key={item.id}>
            {short === undefined ? null : (
              <Chip tone="white" className={`${DIETARY_CHIP} ${DIETARY_LABEL.short}`}>
                {short}
              </Chip>
            )}

            <Chip
              tone="white"
              className={
                short === undefined ? DIETARY_CHIP : `${DIETARY_CHIP} ${DIETARY_LABEL.long}`
              }
            >
              {item.text.label}
            </Chip>
          </li>
        );
      })}
    </ul>
  );
}
