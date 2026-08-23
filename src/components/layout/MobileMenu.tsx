"use client";

import { useReducedMotionConfig } from "motion/react";
import * as m from "motion/react-m";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import { revealMotionVariants } from "@/components/motion/variants";
import { breakpoints, rise } from "@/design/tokens";
import { usePathname } from "@/i18n/navigation";

import { Hamburger } from "./Hamburger";
import { NAV_LINK_CLASS, NavLink, type NavLinkItem } from "./PrimaryNav";

/**
 * The hamburger sheet (04 `D-04.8`, §3.1; sign-off is OQ-04.1).
 *
 * A full-screen cream sheet below the sticky nav carrying the six primary
 * links, `common.nav.contact`, the three locale rows and the "Book a tour"
 * pill. The design leaves it undesigned — `docs/design/mobile/README.md` says
 * only "build a simple full-screen or sheet menu with the same link set" — so
 * every value here is either a token or 04's stated default.
 *
 * **It owns the open state, and the trigger with it.** 04 §3.1 lists
 * `Hamburger` and `MobileMenu` separately, and the a11y contract couples them:
 * focus is trapped in the sheet, `Escape` closes it, the rest of the page is
 * `inert`, body scroll is locked, and focus returns to the button. Every one of
 * those has to be released by whoever put it in place, so the state lives here
 * and `Hamburger` stays a presentational button. `SiteHeader` therefore renders
 * this one component and gets both.
 *
 * **Closing on a link click is delegated, not wired per link.** The sheet's own
 * list, the locale rows and the CTA all arrive by different routes — two of
 * them as server-rendered `children` this component cannot reach into — so the
 * sheet listens for a click that landed on any `<a>` inside it. The handler is
 * on the bubble phase, which is 06 §6.4's order: the link's own work runs
 * first, the sheet closes, and the browser's scroll or the router navigation
 * then happens against a closed sheet.
 *
 * **Its link list is the third of 06 `D-06.7`'s three**, and it is
 * `PrimaryNav`'s {@link NavLink} rather than a third copy of the rule.
 *
 * **Motion is 05's default `rise`** (OQ-05.3, whose default ships): one
 * catalogue row that is already opacity + 6–18 px of travel, so "fade + rise"
 * is a single variant and not two stacked. There is no exit animation: an exit
 * needs `AnimatePresence`, which `eslint.config.mjs` allows in exactly two
 * files (`MotionProvider` and `WordSwap`), and a sheet that dismisses instantly
 * is the better half of that trade — the reader has already asked for it to go.
 */

export type MobileMenuProps = {
  /**
   * The sheet's rows — `site.nav.footer[]` resolved by `SiteHeader`: the six
   * primary links plus Contact, in the order `content/site.json` declares them.
   *
   * 04 §3.1 sketches this as two props, `links` and `contact`. They are one
   * list here because `site.nav.footer[]` already *is* that list, and splitting
   * it would mean writing the id `"contact"` into TypeScript to find it again —
   * against the whole point of keeping nav membership in content (02 `D-02.12`).
   */
  readonly links: readonly NavLinkItem[];
  /** `LangSwitcher variant="sheet"` and the sheet `BookTourButton`, server-rendered. */
  readonly children: ReactNode;
};

/**
 * The tab cycle. Deliberately not filtered by visibility: the sheet is only in
 * the DOM while it is open, so everything this selector finds inside it is
 * reachable.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), summary, input, select, textarea, [tabindex]:not([tabindex="-1"])';

function focusablesOf(root: HTMLElement | null): HTMLElement[] {
  return root === null ? [] : [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

export function MobileMenu({ links, children }: MobileMenuProps) {
  const t = useTranslations("common");
  const pathname = usePathname();
  const sheetId = useId();
  const reduced = useReducedMotionConfig() === true;

  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  /**
   * A route change closes the sheet (06 §6.4). Adjusted during render rather
   * than in an effect — React's own pattern for state that derives from a
   * changing input, and the one that does not cost a second render pass. A
   * click on a sheet link is already handled below; this is what catches the
   * browser's Back and Forward buttons.
   */
  const [seenPathname, setSeenPathname] = useState(pathname);
  if (seenPathname !== pathname) {
    setSeenPathname(pathname);
    setOpen(false);
  }

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setOpen((previous) => !previous);
  }, []);

  /** Focus moves into the sheet on open and back to the button on close. */
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      focusablesOf(sheetRef.current)[0]?.focus();
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    buttonRef.current?.focus();
  }, [open]);

  /**
   * The page behind the sheet is `inert` and the body does not scroll. The
   * header itself stays live — it is the element the sheet is rendered inside,
   * and it holds the button that closes it.
   */
  useEffect(() => {
    if (!open) return undefined;

    const host = sheetRef.current?.closest("body > *") ?? null;
    const behind = [...document.body.children].filter((element) => element !== host);
    for (const element of behind) element.setAttribute("inert", "");

    const restoreOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      for (const element of behind) element.removeAttribute("inert");
      document.body.style.overflow = restoreOverflow;
    };
  }, [open]);

  /**
   * The sheet exists only below `lg` (04 `D-04.9`), and crossing that line
   * while it is open has to *close* it rather than merely hide it. `lg:hidden`
   * alone would leave the page `inert` and unscrollable behind a sheet nobody
   * can see, with the button that dismisses it hidden as well. The trigger is
   * `lg:hidden` too, so the desktop row can never open the sheet in the first
   * place — this is the resize case and nothing else.
   */
  useEffect(() => {
    if (!open || typeof window.matchMedia !== "function") return undefined;

    const desktop = window.matchMedia(`(min-width: ${String(breakpoints.lg)}px)`);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };

    desktop.addEventListener("change", onChange);
    return () => {
      desktop.removeEventListener("change", onChange);
    };
  }, [open]);

  const variants = useMemo(() => revealMotionVariants("rise", { reduced }), [reduced]);

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;

    const stops = focusablesOf(sheetRef.current);
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (first === undefined || last === undefined) return;

    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("a") !== null) close();
  }

  return (
    <>
      <Hamburger ref={buttonRef} controlsId={sheetId} expanded={open} onToggle={toggle} />
      {open ? (
        <m.div
          ref={sheetRef}
          id={sheetId}
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.label")}
          variants={variants}
          custom={{ riseDistance: rise.sm }}
          initial="hidden"
          animate="visible"
          onKeyDown={onKeyDown}
          onClick={onClick}
          className="fixed inset-x-0 top-(--nav-h) bottom-0 z-40 flex flex-col gap-6 overflow-y-auto bg-cream px-(--section-px) py-8 lg:hidden"
        >
          <ul className="flex flex-col">
            {links.map((item) => (
              <li key={item.id}>
                <NavLink href={item.href} className={NAV_LINK_CLASS}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-6 border-t border-divider pt-6">{children}</div>
        </m.div>
      ) : null}
    </>
  );
}
