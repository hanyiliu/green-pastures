"use client";

import { useCallback, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { RevealItem } from "@/components/motion/Reveal";
import { WordSwap } from "@/components/motion/WordSwap";
import type { DayId } from "@/content/schemas/menu";

import { DAY_CHIP, DAY_CHIP_ROW, DAY_CHIP_STATE } from "./layout";

/**
 * Mon–Fri, and the sample line they swap (04 §4's `MenuDayChips` row,
 * `D-04.10`; 05 §5.6; D L199–205, M L129–135).
 *
 * This is the only interactive part of the Menu section and the only client
 * component in it.
 *
 * ── Nothing that reaches the browser is copy ─────────────────────────────
 *
 * `D-04.10`: the chip labels arrive pre-formatted (the server ran the
 * `weekdayShort` format), the five sample lines arrive as already-rendered
 * server nodes, and the tablist's name arrives as `groupLabel`. No dishes, no
 * `home` namespace and no collection cross the boundary — which is why
 * `src/i18n/messages.ts` leaves `menu` out of `CLIENT_NAMESPACES` and says so.
 * 10 §PR-5.3's "client, `menu` + `common` namespaces" is one document out of
 * date on this point; 04 §6's client-namespace table gives this component "—",
 * and that is what ships.
 *
 * ── The default day is the server's, and that is the whole point ─────────
 *
 * `defaultDay` is computed in `site.timeZone` by `src/lib/menu-day.ts` before
 * any of this renders (`D-04.10`), so `useState` opens on it and the first
 * client render is byte-identical to the server's: the right chip is already
 * amber and the right line is already on screen before hydration, and stays
 * that way with JavaScript switched off. Reading a clock here instead would
 * answer with the *reader's* timezone and produce the hydration mismatch this
 * row exists to avoid. 10 §PR-5.3's "after hydration" is the same document out
 * of date; 04 `D-04.10` and 05 §5.6 both say "computed on the server", and the
 * discrepancy is filed.
 *
 * `initial={false}` inside `WordSwap` follows from the same fact: the first
 * line was never absent, so only a *change* of day animates.
 *
 * ── Two stagger children, not one ────────────────────────────────────────
 *
 * Both references put the chip row and the sample line in the same
 * `data-stagger` column as the plate, and give every child after the first the
 * `gpdrop` entrance (D L609). So this component renders two `RevealItem`s
 * rather than wrapping itself in one: the plate is child 0 (`roll`), the chips
 * child 1 and the line child 2, each 110 ms behind the last. They carry no
 * viewport of their own — Motion drives them from the container above — so the
 * page is still one observer (INV-05.9).
 *
 * ── The tabs pattern ─────────────────────────────────────────────────────
 *
 * `role="tablist"` named by `groupLabel`, one `role="tab"` per day, and one
 * `role="tabpanel"` for the line they all control (04 §4). Focus roves: the
 * selected tab is the only one in the tab order, and the arrow keys move both
 * the focus and the selection, which is the APG's automatic-activation tab —
 * right for a control whose panel is a single line of text already in the
 * document.
 *
 * **The panel is not itself focusable.** The APG suggests `tabindex="0"` on a
 * panel with no focusable content, and `jsx-a11y/no-noninteractive-tabindex`
 * refuses it under this repo's strict preset. Dropping it costs nothing here
 * that the pattern is for: the panel is one line of static prose sitting in the
 * document flow, so it is read in order by a screen reader whether or not it is
 * a tab stop, and the chips' `aria-controls` already names it. A panel holding
 * links or a scroll region would be a different question.
 */

/** One chip: a day id and the label the server produced for it. */
export type MenuDay = {
  readonly id: DayId;
  /** From the `weekdayShort` format — "Mon" / "周一" (02 `D-02.6`). */
  readonly label: string;
};

export type MenuDayChipsProps = {
  /** `site.menu.days` in display order, with their formatted labels. */
  readonly days: readonly MenuDay[];
  /** One server-rendered `SampleLine` per day; only the selected one mounts. */
  readonly lines: Readonly<Record<string, ReactNode>>;
  /** Today in `site.timeZone`, computed on the server (`D-04.10`). */
  readonly defaultDay: DayId;
  /** The tablist's accessible name — `menu.dayChips.label`. */
  readonly groupLabel: string;
};

/** The `id` of a day's chip, which its panel is labelled by. */
function tabId(day: string): string {
  return `menu-day-${day}`;
}

/** The one panel every chip controls. */
const PANEL_ID = "menu-sample-line";

/**
 * Where an arrow key moves the selection, or `null` for a key this list does
 * not handle. Left/Right wrap; Home and End jump to the ends.
 */
function nextIndex(key: string, index: number, length: number): number | null {
  if (key === "ArrowRight") return (index + 1) % length;
  if (key === "ArrowLeft") return (index === 0 ? length : index) - 1;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  return null;
}

export function MenuDayChips({ days, lines, defaultDay, groupLabel }: MenuDayChipsProps) {
  const [selected, setSelected] = useState<DayId>(defaultDay);
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * Move the selection *and* the focus together. The focus half is a DOM read
   * rather than a ref array because the chips are rendered from `days` and the
   * list is short: `[data-day]` in DOM order is the same list React just wrote.
   */
  const move = useCallback(
    (index: number) => {
      const day = days[index];
      if (day === undefined) return;
      setSelected(day.id);
      listRef.current?.querySelector<HTMLButtonElement>(`[data-day="${day.id}"]`)?.focus();
    },
    [days],
  );

  /**
   * The arrow keys live on the **chips**, not on the tablist.
   *
   * Delegating from the container would be fewer handlers and is what the tabs
   * pattern is usually written as — and it makes the container an element with
   * an interactive role and a key handler that nothing can focus, which
   * `jsx-a11y/interactive-supports-focus` reports and is right to: in a roving
   * tablist the focus is always on a chip, so that is where the keys belong.
   */
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const target = nextIndex(event.key, index, days.length);
      if (target === null) return;
      event.preventDefault();
      move(target);
    },
    [days, move],
  );

  return (
    <>
      <RevealItem variant="drop" index={1}>
        <div ref={listRef} role="tablist" aria-label={groupLabel} className={DAY_CHIP_ROW}>
          {days.map((day, index) => {
            const isSelected = day.id === selected;

            return (
              <button
                key={day.id}
                type="button"
                role="tab"
                id={tabId(day.id)}
                data-day={day.id}
                aria-selected={isSelected}
                aria-controls={PANEL_ID}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => {
                  setSelected(day.id);
                }}
                onKeyDown={(event) => {
                  onKeyDown(event, index);
                }}
                className={`${DAY_CHIP} ${isSelected ? DAY_CHIP_STATE.selected : DAY_CHIP_STATE.unselected}`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      </RevealItem>

      <RevealItem variant="drop" index={2}>
        <div id={PANEL_ID} role="tabpanel" aria-labelledby={tabId(selected)}>
          <WordSwap swapKey={selected} as="div">
            {lines[selected]}
          </WordSwap>
        </div>
      </RevealItem>
    </>
  );
}
