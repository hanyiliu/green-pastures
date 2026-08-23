import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { SectionTitle } from "@/components/ui/SectionTitle";
import type { ProgramEntry } from "@/content/collections";

import {
  STONE,
  STONE_AGE,
  STONE_ITEM,
  STONE_ITEM_MIRRORED,
  STONE_PATH,
  STONE_RING,
  STONE_TEXT_MIRRORED,
} from "./layout";
import { SteppingStone } from "./SteppingStone";

/**
 * The three stepping stones (04 §3.5's `StonePath` row; D L165–181, M L99–113).
 *
 * A `<ul>` of three `<li>`s in `site.programs[]` order on both views — the
 * design's own order, Infant → Toddler → Preschool, and the only ordering rule
 * either reference has. Below `lg` it is the alternating path, at `lg` the
 * bottom-aligned row of three; both are the same DOM, differing only in the
 * classes `layout.ts` hands out (INV-04.4: no per-view files, no view props).
 *
 * ── The entrance ─────────────────────────────────────────────────────────
 *
 * One `Reveal stagger` container, three `RevealItem variant="sprout"` children
 * — 05 §5.1's illustrative usage for this exact section, and §5.3's Programs
 * row ("3 stones → `sprout`"). The container is never itself transformed
 * (INV-05.4) and the children carry no viewport of their own, so the whole
 * group costs the page nothing beyond the one pooled observer (INV-05.9).
 *
 * ── Why the type is `import type` ────────────────────────────────────────
 *
 * `src/content/collections.ts` throws on import in a browser (02 `D-02.16`), so
 * a value import here would make this file unrenderable in jsdom and unusable
 * from a client subtree. `ProgramEntry` is erased at compile time, which is all
 * this file needs: the loader itself is called once, in `ProgramsSection`.
 *
 * ── The two type sizes, and the one 03 has not minted ────────────────────
 *
 * The name is `--text-program-title` (20/23px), the token 03 §3.2 mints for
 * "stepping-stone titles". The **featured** name is 22/28px in the same cell of
 * the same row, and 03 mints nothing for it — the shape it already uses for
 * Reviews' 36px and Visit's 42px title, which `SectionHeader` records as "a
 * per-section deviation … belongs to that section's recipe".
 *
 * So {@link TITLE}`.featured` names `--text-program-title-featured` with the
 * base token as its CSS fallback. Today the variable does not exist and the
 * title renders at 20/23px; the day 03 mints it, the featured stone grows to
 * the drawn 22/28px with no code change here. That is the same
 * mint-it-later shape `SectionTitle` uses for
 * `leading-(--text-section-title--line-height)`, with the fallback written
 * inline so nothing above this element has to supply it. A
 * `--text-program-title-featured` is requested of 03.
 *
 * The summary is `--text-blurb`, whose "Used for" cell in 03 §3.2 is
 * "teacher/program blurbs". Its mobile 13px is the drawing exactly (M L102);
 * its desktop 15px/1.6 is the *head teacher's* value, and the same cell prints
 * "14px/1.5 programs" without minting a token for it. That one is 03's to
 * resolve too, and is filed rather than invented here.
 */

/** 03 §3.2's stepping-stone title, and the deviation 03 has yet to mint — see above. */
const TITLE = {
  base: "text-program-title!",
  featured: "text-[length:var(--text-program-title-featured,var(--text-program-title))]!",
} as const;

/** The blurb recipe: Nunito 600 on `--section-sub` at `--text-blurb`. */
const SUMMARY = "font-body text-blurb font-semibold text-(color:--section-sub)";

export type StonePathProps = {
  /** `site.programs[]` joined with this locale's text, in the order `site.json` declares. */
  readonly items: readonly ProgramEntry[];
};

export function StonePath({ items }: StonePathProps) {
  return (
    <Reveal id="programs.stones" stagger as="ul" className={STONE_PATH}>
      {items.map((entry, index) => {
        const size = entry.featured ? "featured" : "base";
        const geometry = STONE[size];
        // The alternating path, and why it is parity — see STONE_ITEM_MIRRORED.
        const mirrored = index % 2 === 1;
        // `D-04.5`: both strings render and `md:` picks one, so no view is a
        // branch. Only Infant is drawn with a shorter blurb (M L102 vs D L169).
        const short = entry.text.summaryShort;

        // Every class list is assembled here rather than inside a `className`,
        // because `prettier-plugin-tailwindcss` trims the string literals it
        // finds in that attribute — including a deliberate leading space
        // between two interpolations, which silently welds two classes into
        // one. A variable is opaque to it, and the joins below are explicit.
        const item = mirrored
          ? `${STONE_ITEM} ${geometry.item} ${STONE_ITEM_MIRRORED}`
          : `${STONE_ITEM} ${geometry.item}`;
        const summary = `${SUMMARY} ${geometry.summary}`;
        const longSummary = short === undefined ? summary : `${summary} hidden md:block`;

        return (
          <RevealItem key={entry.id} as="li" variant="sprout" index={index} className={item}>
            <SteppingStone
              id={`deco-programs-stone-${entry.id}`}
              size={size}
              className={STONE_RING}
            >
              <PhotoSlot
                slotId={entry.id}
                alt={entry.text.photoAlt}
                shape="circle"
                className={geometry.photo}
              />
            </SteppingStone>

            <div className={mirrored ? STONE_TEXT_MIRRORED : undefined}>
              <SectionTitle as="h3" className={TITLE[size]}>
                {entry.text.name}
              </SectionTitle>

              <Eyebrow as="div" size="sm" className={STONE_AGE}>
                {entry.text.ageLabel}
              </Eyebrow>

              {short === undefined ? null : <p className={`${summary} md:hidden`}>{short}</p>}

              <p className={longSummary}>{entry.text.summary}</p>
            </div>
          </RevealItem>
        );
      })}
    </Reveal>
  );
}
