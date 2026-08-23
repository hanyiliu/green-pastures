import { RevealItem } from "@/components/motion/Reveal";
import { PhotoSlot } from "@/components/ui/PhotoSlot";

import {
  polaroidAspect,
  polaroidPlacement,
  polaroidTilt,
  POLAROID_FRAME,
  type SlotPlacement,
} from "./layout";

/**
 * One photograph on the wall (04 §Components, `D-04.15`, INV-04.5).
 *
 * Two layers, and the split is the whole point (05 §5.2, `D-05.12`):
 *
 * - the **outer layer is Motion's**. It is the `RevealItem` that plays the
 *   `polaroid` entrance — in from ±150px with ±10° of spin — so its
 *   `transform` belongs to the animation and nothing else may write it. That
 *   is why the slot's placement is `left`/`top`/`width` and why the narrow
 *   view's centred slot uses a negative margin rather than a translate;
 * - the **inner layer is CSS's**. The frame carries the resting ±2–6° tilt and
 *   the hover straighten, neither of which Motion ever touches. 05 §5.2 says it
 *   in as many words: "the entrance rotation is separate from the resting
 *   ±2–6° tilt, which lives on the inner frame".
 *
 * Under reduced motion the entrance becomes opacity-only and the tilt simply
 * stays (05 §5.9, row E7: "resting tilt kept (static)") — it is a static class,
 * not an animation, so nothing has to preserve it deliberately.
 *
 * **Which side it flies in from is not decided here.** `RevealItem` is given
 * the photo's DOM index and the catalogue derives the side from its parity —
 * even from the left, odd from the right (05 §5.2). Passing an explicit `side`
 * would fork a rule that already exists.
 *
 * **The photograph is a `PhotoSlot`, not an image.** No photograph has been
 * supplied yet and `public/images/` is empty by design until Phase 8, so the
 * slot reserves the box and carries the `alt` (INV-04.6, `D-04.12`). Dropping
 * the real photo in later does not move the frame.
 */

/** `deco-` + the section id + the photo's own id (INV-05.5's naming scheme). */
function decorationId(photoId: string): string {
  return `deco-gallery-${photoId}`;
}

export type PolaroidProps = {
  /** The photo's `site.json` id — the slot's data attribute and the frame's. */
  readonly id: string;
  /** The photograph's accessible name, from `collections.gallery.photos.<id>.alt`. */
  readonly alt: string;
  /** Which slot draws it on each view, from `layout.ts` (`D-04.6`). */
  readonly slot: SlotPlacement;
};

export function Polaroid({ id, alt, slot }: PolaroidProps) {
  const decoration = decorationId(id);

  return (
    <RevealItem as="li" variant="polaroid" index={slot.index} className={polaroidPlacement(slot)}>
      <figure
        id={decoration}
        data-deco={decoration}
        className={`${POLAROID_FRAME} ${polaroidTilt(slot)}`}
      >
        <PhotoSlot slotId={id} alt={alt} radius="polaroid" className={polaroidAspect(slot)} />
      </figure>
    </RevealItem>
  );
}
