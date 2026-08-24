"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { PhotoSlot } from "@/components/ui/PhotoSlot";

import {
  LIGHTBOX,
  LIGHTBOX_BUTTON,
  LIGHTBOX_CONTROLS,
  LIGHTBOX_FRAME,
  LIGHTBOX_PHOTO,
  LIGHTBOX_PHOTO_BOX,
} from "./layout";
import type { GalleryItem } from "./types";

/**
 * The lightbox (04 §3.6, `D-04.7`, OQ-04.2 answered yes).
 *
 * ── Neither reference draws it ───────────────────────────────────────────
 *
 * Both print "Tap any photo to enlarge — lightbox on the live site" where the
 * modal would be (D L507, M L405), so this is the one surface on either of this
 * row's pages with no drawing to match. `D-04.7` and 04 §5.5 are the whole
 * specification — "native modal `<dialog>` (built-in trap), focus returns to
 * the opening thumbnail" — and the geometry is 03's tokens.
 *
 * ── Everything the pattern needs, the platform already does ──────────────
 *
 * `showModal()` buys the focus trap, the inert background, the `::backdrop`,
 * the top layer and `Escape` — all of it, correctly, for free. That is why
 * `D-04.7` chose a `<dialog>` over a div with `role="dialog"`, and this
 * component adds exactly three things the platform does not:
 *
 * - **`close` is the single exit.** `Escape` fires `cancel` then `close`, the
 *   button calls `close()`, and a click on the backdrop closes too — so the
 *   caller hears about every route out through one `onClose`, and there is no
 *   state that can disagree with whether the dialog is open.
 * - **Focus returns to the thumbnail.** The platform restores focus to whatever
 *   was focused when `showModal()` ran, which is right when a pointer opened
 *   the dialog and wrong after the arrows have walked to another photograph:
 *   the reader should land on the thumbnail they are actually looking at.
 *   `onClose` is handed the current id and the grid's own button id, and the
 *   explorer moves the focus.
 * - **Arrow keys step through the photographs.** 04 §3.6 asks for them, and
 *   they are the arrows' keyboard twin. They are bound on the dialog rather
 *   than on `window`: a modal `<dialog>` makes the rest of the document inert,
 *   so nothing else can be the key target while it is open, and a document
 *   listener would be a second place to remember to remove.
 *
 * ── Why the effects drive the dialog rather than JSX props ───────────────
 *
 * Two reasons, one per effect.
 *
 * `<dialog open>` renders a *non-modal* dialog — no top layer, no backdrop, no
 * trap, no `Escape`. Only the `showModal()` call produces the modal behaviour
 * this component is chosen for, and only an effect can make an imperative call,
 * so the open state is a prop and the call is synchronised to it.
 *
 * The `keydown` and `click` handlers are attached to the node for a second
 * reason: as JSX props they are `jsx-a11y/no-noninteractive-element-*` errors.
 * The rule does not know `<dialog>` is interactive — it is not in its element
 * role map — and it is right to be strict, so this listens on the node rather
 * than disabling the rule. `onClose` stays a prop, because a `close` event is
 * neither a mouse nor a keyboard event and the rule does not touch it.
 */

export type LightboxProps = {
  /** The photograph on screen, or `null` when the dialog is closed. */
  readonly item: GalleryItem | null;
  /** The filtered list the arrows walk, in the order the grid draws it. */
  readonly items: readonly GalleryItem[];
  /** Show the photograph `step` places away, wrapping at both ends. */
  readonly onStep: (step: number) => void;
  readonly onClose: () => void;
};

/** Left steps back, right steps on; both wrap, which {@link LightboxProps.onStep} owns. */
function stepFor(key: string): number | null {
  if (key === "ArrowRight") return 1;
  if (key === "ArrowLeft") return -1;
  return null;
}

export function Lightbox({ item, items, onStep, onClose }: LightboxProps) {
  const t = useTranslations("common.lightbox");
  const dialogRef = useRef<HTMLDialogElement>(null);

  const isOpen = item !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    // `showModal()` on an already-open dialog throws, and `close()` on a closed
    // one fires a spurious `close` event, so both calls are guarded by the
    // platform's own `open` rather than by state kept here.
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null || !isOpen) return;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const step = stepFor(event.key);
      if (step === null || items.length < 2) return;
      event.preventDefault();
      onStep(step);
    };

    /*
     * A click that lands on the dialog element itself is a click on the padding
     * around the photo — everything inside is a child — which is the backdrop
     * as far as a reader is concerned. `close()` rather than `onClose()` so
     * that this route out arrives through the same `close` event as the other
     * two.
     */
    const onClick = (event: MouseEvent) => {
      if (event.target === dialog) dialog.close();
    };

    dialog.addEventListener("keydown", onKeyDown);
    dialog.addEventListener("click", onClick);

    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      dialog.removeEventListener("click", onClick);
    };
  }, [isOpen, items.length, onStep]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={item === null ? undefined : item.alt}
      onClose={onClose}
      className={LIGHTBOX}
    >
      {item === null ? null : (
        <div className={LIGHTBOX_FRAME}>
          <div
            /*
             * The photograph's own ratio, from `site.gallery.photos[]`. It is a
             * runtime value, so it cannot be a Tailwind class — v4 scans source
             * text for whole class names — and it is data rather than a design
             * constant, so it is not a token either.
             */
            style={{ aspectRatio: `${String(item.width)} / ${String(item.height)}` }}
            className={LIGHTBOX_PHOTO_BOX}
          >
            {/*
              No `alt` here: the dialog carries it, so a labelled slot inside
              would put the same sentence in the accessible name twice.
            */}
            <PhotoSlot slotId={item.id} className={LIGHTBOX_PHOTO} />
          </div>

          <div className={LIGHTBOX_CONTROLS}>
            <button
              type="button"
              data-lightbox="close"
              onClick={() => {
                dialogRef.current?.close();
              }}
              className={LIGHTBOX_BUTTON}
            >
              {t("close")}
            </button>

            <div className={LIGHTBOX_CONTROLS}>
              <button
                type="button"
                data-lightbox="prev"
                onClick={() => {
                  onStep(-1);
                }}
                className={LIGHTBOX_BUTTON}
              >
                {t("prev")}
              </button>
              <button
                type="button"
                data-lightbox="next"
                onClick={() => {
                  onStep(1);
                }}
                className={LIGHTBOX_BUTTON}
              >
                {t("next")}
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
