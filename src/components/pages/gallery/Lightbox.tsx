"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";

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
 * - **`close` is the single exit for the open state.** Every route out — the
 *   button, a click on the backdrop, `Escape` — ends in one `close` event, so
 *   the caller hears about all three through one `onClose` and there is no
 *   state that can disagree with whether the dialog is open.
 * - **Focus returns to the thumbnail, in the same task as the close.** See
 *   {@link dismiss}: the platform restores focus to whatever was focused when
 *   `showModal()` ran, which is right when a pointer opened the dialog and
 *   wrong after the arrows have walked to another photograph.
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
 * The `keydown`, `click` and `cancel` handlers are attached to the node for a
 * second reason: as JSX props the first two are
 * `jsx-a11y/no-noninteractive-element-*` errors. The rule does not know
 * `<dialog>` is interactive — it is not in its element role map — and it is
 * right to be strict, so this listens on the node rather than disabling the
 * rule. `onClose` stays a prop, because a `close` event is neither a mouse nor
 * a keyboard event and the rule does not touch it.
 */

export type LightboxProps = {
  /** The photograph on screen, or `null` when the dialog is closed. */
  readonly item: GalleryItem | null;
  /** The filtered list the arrows walk, in the order the grid draws it. */
  readonly items: readonly GalleryItem[];
  /**
   * The `id` of the element focus must be on once this dialog has closed —
   * the grid's button for the photograph on screen. `null` while there is
   * nothing open to return from. See {@link dismiss} for why the correction
   * cannot wait for the `close` event.
   */
  readonly returnFocusId: string | null;
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

export function Lightbox({ item, items, returnFocusId, onStep, onClose }: LightboxProps) {
  const t = useTranslations("common.lightbox");
  const dialogRef = useRef<HTMLDialogElement>(null);

  const isOpen = item !== null;

  /**
   * Close the dialog and put focus where the reader left off — **in one task**.
   *
   * HTML's "close the dialog" runs the focusing steps for the previously
   * focused element *synchronously* and then **queues** a task to fire `close`.
   * So the two halves of this are not simultaneous and never can be: the moment
   * `close()` returns, `dialog.open` is already `false` and focus is already
   * back on the thumbnail that *opened* the lightbox, while any correction
   * keyed on the `close` event is still a whole task away. Measured in this
   * project's own Chromium, that gap runs **0.9–6.2 ms** — long enough that a
   * reader's screen reader, or a test, can read `open === false` and the wrong
   * element focused, and half of a 12-run sample did.
   *
   * Re-pointing here rather than in `onClose` closes the window by
   * construction: nothing can observe the document between these two
   * statements, so "the dialog is shut" and "focus is on the photograph shown"
   * become one observable step. `onClose` keeps the *state* — it still fires
   * for every route out, including any this function did not take.
   */
  const dismiss = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    dialog.close();
    if (returnFocusId === null) return;
    document.getElementById(returnFocusId)?.focus();
  }, [returnFocusId]);

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
     * as far as a reader is concerned.
     */
    const onClick = (event: MouseEvent) => {
      if (event.target === dialog) dismiss();
    };

    /*
     * `Escape`'s own close would restore focus to the opening thumbnail and
     * only then queue the `close` event, which is the gap {@link dismiss}
     * exists to close. `cancel` is the platform's hook for taking a close over:
     * veto the one it was about to do, and do the same close here, where the
     * focus correction is the next statement rather than the next task.
     */
    const onCancel = (event: Event) => {
      event.preventDefault();
      dismiss();
    };

    dialog.addEventListener("keydown", onKeyDown);
    dialog.addEventListener("click", onClick);
    dialog.addEventListener("cancel", onCancel);

    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      dialog.removeEventListener("click", onClick);
      dialog.removeEventListener("cancel", onCancel);
    };
  }, [dismiss, isOpen, items.length, onStep]);

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
              onClick={dismiss}
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
