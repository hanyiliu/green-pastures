import { getLocale, getTranslations } from "next-intl/server";

import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { getPrograms } from "@/content/collections";

import { ROOM_LIST } from "./layout";
import { RoomCard } from "./RoomCard";

/**
 * The three rooms of the Programs page (04 §3.6; D L398–427, M L303–318).
 *
 * ── Where the data comes from ───────────────────────────────────────────
 *
 * `getPrograms()` with the locale from `getLocale()`, which is 04 §5.1's one
 * named way to read a collection and the reason this is an `async` Server
 * Component. Reading the same text through
 * `useTranslations("collections.programs")` would keep it synchronous and lose
 * the fallback 02 built the loader for — both Chinese
 * `collections/programs.json` files are still `{}`, so a missing `photoAlt`
 * would be a `⟦…⟧` marker read out as an image's name rather than the English
 * alt. `ProgramsSection` makes the same choice for the same reason.
 *
 * The order is `site.programs[]`'s, because that is the order `getPrograms()`
 * returns; nothing here sorts, filters or names a room.
 *
 * ── The entrance ────────────────────────────────────────────────────────
 *
 * 04 §3.6 gives this row `riseChild` stagger, so it is one `Reveal stagger`
 * holding three `RevealItem`s — one observer for the group rather than one per
 * card (INV-05.9), children 110 ms apart in DOM order. The container renders as
 * the `<ul>` and each item as an `<li>`, so the entrance costs the list nothing
 * semantically (04 §3.6: "`<ul>`").
 *
 * ── The ratio label is formatted here ───────────────────────────────────
 *
 * `programs.ratioLabel` takes `{adults}` and `{children}` from
 * `site.programs[].ratio`, and formatting it here rather than in `RoomCard`
 * keeps the leaf free of a translator — one `t` call site for the page's one
 * argument-taking message.
 */

/** The `Reveal` registry key for the card list (`"<page>.<slot>"`, 05 §5.1). */
const ROOMS_REVEAL_ID = "programs.rooms";

export async function RoomCards() {
  const locale = await getLocale();
  const t = await getTranslations("programs");
  const programs = await getPrograms(locale);

  return (
    <Reveal id={ROOMS_REVEAL_ID} stagger as="ul" className={ROOM_LIST}>
      {programs.map((program, index) => (
        <RevealItem key={program.id} as="li" variant="riseChild" index={index}>
          <RoomCard
            program={program}
            index={index}
            ratioLabel={t("ratioLabel", {
              // `String(...)` because the next-intl plugin types every ICU
              // argument of `programs.ratioLabel` as a string: the message
              // interpolates them plainly (`{adults}:{children} ratio`) rather
              // than through a `number` skeleton, so no locale-aware number
              // formatting is being skipped here — 1 and 3 are the same glyphs
              // in all three locales, and a grouped "1,000:1" is not a ratio
              // anyone writes.
              adults: String(program.ratio[0]),
              children: String(program.ratio[1]),
            })}
          />
        </RevealItem>
      ))}
    </Reveal>
  );
}
