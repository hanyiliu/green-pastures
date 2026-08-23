import { Reveal } from "@/components/motion/Reveal";
import type { GalleryPhotoEntry } from "@/content/collections";

import { assignSlots, GALLERY_FIELD } from "./layout";
import { Polaroid } from "./Polaroid";

/**
 * The scattered photo wall (04 §Components, `PolaroidField`).
 *
 * A stagger container and nothing else. It is never itself transformed
 * (INV-05.4) — it only sequences its children 110ms apart in DOM order — and it
 * carries no `overflow` of any kind, because a clipping ancestor above a
 * translating element is exactly what INV-05.2 forbids. The references clip the
 * wall with `overflow: hidden` on the section; the plan clips once, at
 * `html { overflow-x: clip }` (05 §5.8), and never here.
 *
 * **Seven polaroids on the wide view, five on the narrow one, from one DOM.**
 * The list rendered is every `onHome` photo; the two the narrow view omits are
 * `onMobile: false` in `site.json` and are hidden by CSS, never filtered by a
 * viewport check in JavaScript (`D-04.5`: "an item with `onMobile: false` is
 * rendered and hidden … no hydration mismatch, no layout shift"). Which slot
 * each photo lands in is {@link assignSlots}'s answer, in `site.json` order.
 *
 * `<ul>` / `<li>` because a wall of photographs is a list, and `Reveal`'s `as`
 * exists so the wrapper does not cost the semantics (05 §5.1).
 */

/** The registry key of the wall's entrance, `"<section>.<slot>"` (05 §5.1). */
const FIELD_REVEAL_ID = "gallery.polaroids";

export type PolaroidFieldProps = {
  /** The `onHome` photos, in `site.json` order, joined with this locale's text. */
  readonly photos: readonly GalleryPhotoEntry[];
};

export function PolaroidField({ photos }: PolaroidFieldProps) {
  return (
    <Reveal id={FIELD_REVEAL_ID} as="ul" stagger className={GALLERY_FIELD}>
      {assignSlots(photos).map(({ photo, ...slot }) => (
        <Polaroid key={photo.id} id={photo.id} alt={photo.text.alt} slot={slot} />
      ))}
    </Reveal>
  );
}
