/**
 * The gallery's geometry (04 `D-04.6`, INV-04.5).
 *
 * Every number the two reference files draw for the photo wall lives here
 * rather than in the components: the two slot tables — seven positions for the
 * wide field, five for the narrow one — the resting tilt of each frame, the
 * aspect ratio of each photo box, and the section's own padding. `site.json`
 * carries only *data*; `D-04.6` is explicit that "polaroid slot
 * positions/sizes/tilts … live in `src/components/sections/<section>/layout.ts`
 * as percentage/grid values", with `photos[].rotation` reserved as an optional
 * per-photo override of the slot tilt.
 *
 * **Two spellings, because the two views are measured differently.** The wide
 * field is a fixed 980×410 box (04 §Sections: "`≥ lg`: 980×410 field, 7 slots
 * (`%` of the field, `aspect-ratio 980/410`)"), so its slots are percentages
 * and scale with the field. The narrow field is fluid, so its five slots are
 * anchored to an edge in px — written on Tailwind's `--spacing` scale, never as
 * a raw px, which is the same spelling `hero/layout.ts` reasoned its way to and
 * the one that keeps INV-03.2 true.
 *
 * **Every class here is a literal.** Tailwind v4 scans source text for whole
 * class names, so a `lg:` prefix composed at runtime would generate no CSS at
 * all. That is why the `lg:` half of each row is written out rather than
 * derived, and why {@link polaroidPlacement} concatenates whole strings and
 * never builds one.
 *
 * **The frame is the positioned box, not the photograph.** The references
 * position the outer white frame and give the *inner* `image-slot` its width,
 * so every width below is the drawn photo plus the frame's two side paddings
 * (10px each `≥ md`, 8px below): slot 1 is 188 + 20 = 208px, and 208/980 is the
 * 21.224% it carries. The photo box then fills the frame's content box and
 * takes its height from `aspect`.
 *
 * Line numbers are `docs/design/desktop/Green Pastures - Homepage.dc.html` (D
 * L222–228) and `docs/design/mobile/Green Pastures - Homepage Mobile.dc.html`
 * (M L152–156).
 */

/** One drawn slot: where the frame sits, how far it leans, what shape its photo is. */
export type PolaroidSlot = {
  /** Absolute placement on the field. */
  readonly position: string;
  /** The frame's resting tilt — `±2–6°` in both references. */
  readonly tilt: string;
  /** The photo box's aspect ratio, from the reference's own slot size. */
  readonly aspect: string;
};

/**
 * The seven slots of the wide field (D L222–228), as percentages of its
 * 980×410 box. `top` resolves against the field's height, which is why the
 * field carries `aspect-[980/410]` rather than an automatic one.
 */
export const DESKTOP_SLOTS: readonly PolaroidSlot[] = [
  {
    position: "lg:left-[2.449%] lg:top-[8.78%] lg:w-[21.224%]",
    tilt: "lg:rotate-[-6deg]",
    aspect: "lg:aspect-[188/148]",
  },
  {
    position: "lg:left-[25.306%] lg:top-[0.976%] lg:w-[23.265%]",
    tilt: "lg:rotate-[3deg]",
    aspect: "lg:aspect-[208/164]",
  },
  {
    position: "lg:left-[50.816%] lg:top-[9.756%] lg:w-[21.224%]",
    tilt: "lg:rotate-[-4deg]",
    aspect: "lg:aspect-[188/148]",
  },
  {
    position: "lg:left-[72.653%] lg:top-[2.439%] lg:w-[20.816%]",
    tilt: "lg:rotate-[5deg]",
    aspect: "lg:aspect-[184/148]",
  },
  {
    position: "lg:left-[15.306%] lg:top-[52.683%] lg:w-[23.061%]",
    tilt: "lg:rotate-[4deg]",
    aspect: "lg:aspect-[206/158]",
  },
  {
    position: "lg:left-[44.082%] lg:top-[54.634%] lg:w-[22.245%]",
    tilt: "lg:rotate-[-5deg]",
    aspect: "lg:aspect-[198/154]",
  },
  {
    position: "lg:left-[70.612%] lg:top-[53.171%] lg:w-[20.816%]",
    tilt: "lg:rotate-[6deg]",
    aspect: "lg:aspect-[184/148]",
  },
];

/**
 * The five slots of the narrow field (M L152–156): two at the top anchored to
 * opposite edges, two in the middle, one centred at the bottom. `-ml-22` is
 * −88px, which is half the last frame's 176px width — the reference's own
 * `left: calc(50% - 88px)`, written so the centring survives Motion owning the
 * element's `transform` (a `-translate-x-1/2` here would be overwritten by the
 * entrance).
 */
export const MOBILE_SLOTS: readonly PolaroidSlot[] = [
  { position: "top-2 left-3 w-41.5", tilt: "rotate-[-5deg]", aspect: "aspect-[150/118]" },
  { position: "top-6.5 right-3 w-41.5", tilt: "rotate-[4deg]", aspect: "aspect-[150/118]" },
  { position: "top-42.5 left-6.5 w-41.5", tilt: "rotate-[3deg]", aspect: "aspect-[150/118]" },
  { position: "top-49 right-5 w-40.5", tilt: "rotate-[-6deg]", aspect: "aspect-[146/114]" },
  { position: "top-82.5 left-1/2 -ml-22 w-44", tilt: "rotate-[2deg]", aspect: "aspect-[160/120]" },
];

/**
 * What the narrow field's anchors leave behind at `lg`. Two of its five slots
 * hang off the right edge and one carries the centring margin, so the wide
 * layout — which is left-anchored throughout — clears both rather than each row
 * restating the reset it happens to need.
 */
const DESKTOP_RESET = "lg:right-auto lg:ml-0";

/** A photo the narrow view does not draw: rendered, hidden by CSS (`D-04.5`). */
const HIDDEN_BELOW_LG = "hidden lg:block";

/**
 * Where one polaroid is drawn on each view. `mobile` is `null` for a photo the
 * narrow view omits — `onMobile: false` in `site.json`, which 04 `D-04.5`
 * requires be rendered and hidden by CSS rather than filtered by a viewport
 * check in JavaScript.
 *
 * This is all `Polaroid` needs: which boxes to sit in, and where it stands in
 * the stagger group. It knows nothing about the photograph.
 */
export type SlotPlacement = {
  /** DOM position in the stagger group; drives the entrance's alternating side. */
  readonly index: number;
  readonly desktop: PolaroidSlot;
  readonly mobile: PolaroidSlot | null;
};

/** A placement with the photo it was assigned to, still attached. */
export type AssignedSlot<TPhoto extends SlottedPhoto> = SlotPlacement & { readonly photo: TPhoto };

/** The `onMobile` flag {@link assignSlots} reads; `id` only names it in an error. */
export type SlottedPhoto = { readonly id: string; readonly onMobile: boolean };

/**
 * Fill the slots in `site.json` order — "editors reorder by editing `site.json`
 * order; slots fill in order" (`D-04.6`).
 *
 * The wide field takes every photo it is given; the narrow one takes the
 * subset flagged `onMobile`, in the same order. Because the two subsets differ,
 * a photo's two slots are not the same row of the two tables: `g05` is the
 * fifth wide slot and the fourth narrow one.
 *
 * Running out of slots throws rather than dropping a photo. An editor who adds
 * an eighth `onHome` photo has changed the design, not the data, and the
 * failure should name the file to change.
 *
 * The photo travels back out with its placement, so the caller pairs the two
 * once — here — instead of re-deriving the pairing by index at the call site.
 */
export function assignSlots<TPhoto extends SlottedPhoto>(
  photos: readonly TPhoto[],
): readonly AssignedSlot<TPhoto>[] {
  if (photos.length > DESKTOP_SLOTS.length) {
    throw new Error(
      `The gallery wall draws ${String(DESKTOP_SLOTS.length)} polaroids, but content/site.json ` +
        `flags ${String(photos.length)} photos onHome. Adding a slot is a change to ` +
        `docs/design/ and src/components/sections/gallery/layout.ts (04 D-04.6).`,
    );
  }

  const onMobile = photos.filter((photo) => photo.onMobile);
  if (onMobile.length > MOBILE_SLOTS.length) {
    throw new Error(
      `The narrow gallery wall draws ${String(MOBILE_SLOTS.length)} polaroids, but ` +
        `content/site.json flags ${String(onMobile.length)} onHome photos onMobile too ` +
        `(04 D-04.6).`,
    );
  }

  let mobileCursor = 0;

  return photos.map((photo, index) => {
    const desktop = DESKTOP_SLOTS[index];
    // Both branches are unreachable while the two length guards above hold;
    // they are what `noUncheckedIndexedAccess` asks for, and a thrown path
    // beats a polaroid stacked at the field's origin with no position at all.
    if (desktop === undefined) throw new Error(`No wide slot for photo "${photo.id}".`);

    if (!photo.onMobile) return { photo, index, desktop, mobile: null };

    const mobile = MOBILE_SLOTS[mobileCursor];
    if (mobile === undefined) throw new Error(`No narrow slot for photo "${photo.id}".`);
    mobileCursor += 1;

    return { photo, index, desktop, mobile };
  });
}

/** Where one polaroid sits on the field, on both views. */
export function polaroidPlacement(slot: SlotPlacement): string {
  const narrow = slot.mobile === null ? HIDDEN_BELOW_LG : slot.mobile.position;
  return `absolute ${narrow} ${slot.desktop.position} ${DESKTOP_RESET}`;
}

/**
 * The frame's resting tilt on both views. A photo the narrow view omits carries
 * only the `lg:` half — it is `display: none` until then, so a tilt below `lg`
 * would style nothing.
 */
export function polaroidTilt(slot: SlotPlacement): string {
  return slot.mobile === null ? slot.desktop.tilt : `${slot.mobile.tilt} ${slot.desktop.tilt}`;
}

/** The photo box's aspect ratio on both views, under the same rule as the tilt. */
export function polaroidAspect(slot: SlotPlacement): string {
  return slot.mobile === null
    ? slot.desktop.aspect
    : `${slot.mobile.aspect} ${slot.desktop.aspect}`;
}

/* -------------------------------------------------------------------------- *
 * The section's own boxes
 * -------------------------------------------------------------------------- */

/**
 * The gallery is the one section whose horizontal padding is not
 * `--section-px`: it drops to 10px below `md` so the wall can bleed wider than
 * a paragraph would (04 §Sections, "section `px` 10px `< md`"; the token file
 * anticipates it in as many words — "gallery overrides px to 10px in 04").
 * Both classes are important, because each replaces a property the `Section`
 * recipe sets, and the `md:` half restates the token rather than re-typing
 * 44px so the section box still moves with `--section-px`.
 */
export const GALLERY_PADDING = "px-2.5! md:px-(--section-px)!" as const;

/**
 * The header keeps the ordinary 24px inset the narrow reference draws (M L147,
 * `padding: 0 24px`) — 14px more than the section now supplies. Above `md` the
 * section's own padding is back and the header adds nothing, exactly as the
 * wide reference draws it.
 */
export const GALLERY_HEADER = "px-3.5 md:px-0" as const;

/**
 * The field the polaroids are positioned against.
 *
 * `≥ lg` it is the reference's 980×410 box, as an aspect ratio so the slots'
 * percentages scale with it. Below that it is fluid and 490px tall — the
 * narrow reference says 420px (M L151) and clips the overflow with
 * `overflow: hidden` on the section, which INV-05.2 forbids us: no clipping
 * ancestor may sit above a translating element. Sized to its content instead,
 * the field is the last slot's 330px top plus the 160px its frame occupies at
 * the wider `≥ md` padding, so the bottom polaroid can never land on the
 * link's 44px hit area (INV-04.7). The design README calls this a "~420px-tall
 * field", which is the tolerance this uses.
 */
export const GALLERY_FIELD =
  "relative mx-auto h-122.5 w-full lg:aspect-[980/410] lg:h-auto lg:max-w-245" as const;

/** The link row, 20px under the field on the narrow view and 34px on the wide one. */
export const GALLERY_LINK_ROW = "mt-5 text-center md:mt-8.5" as const;

/**
 * The polaroid frame itself (04 §Components, "`--radius-polaroid`,
 * `--shadow-polaroid`, 10+30px / 8+24px frame"): a white card with a deep
 * bottom lip, at the frame padding the wide reference draws from `md` upward.
 *
 * **The hover straighten is `motion-safe:`, not `hover:` + a `motion-reduce:`
 * undo.** `Button` can write the pair because its resting transform is none, so
 * "reduced motion" is spelled by returning to zero. A polaroid rests *at* a
 * transform, so the same shape would need a rule that re-applies the tilt and
 * then a second argument about which of two `!important` rules the cascade
 * takes. Gating the straighten on `motion-safe:` removes the question: under
 * `prefers-reduced-motion: reduce` the rule is not emitted, and 05 §5.9's
 * "colour changes only; no transform" holds by construction. Tailwind's own
 * `hover:` is already behind `@media (hover: hover)`, which is the pointer gate
 * `D-05.12` asks for and the one `Button` also relies on.
 *
 * The straighten is important because the tilt it undoes is a `lg:` rule on the
 * same property, and `!important` settles that without depending on which of
 * the two Tailwind emits last.
 *
 * `--dur-word-swap` is 05 §5.10's choice for every hover in the system: the
 * design gives no hover duration and 05 reused this token rather than mint one.
 */
export const POLAROID_FRAME =
  "rounded-polaroid bg-white p-2 pb-6 shadow-polaroid transition " +
  "duration-(--dur-word-swap) ease-soft md:p-2.5 md:pb-7.5 " +
  "motion-safe:hover:scale-103 motion-safe:hover:rotate-none!";
