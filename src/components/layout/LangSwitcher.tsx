"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import { markLocaleSwap } from "@/components/motion/registry";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_META, routing, type Locale } from "@/i18n/routing";

import { track } from "./TrackedLink";

/**
 * The language switcher — one component, one option per enabled locale
 * (04 `D-04.16`, 02 `D-02.10`, 06 `D-06.9`).
 *
 * **Nothing here knows how many locales there are, or what they are called.**
 * The list is `routing.locales.map(...)`, the visible text is
 * `LOCALE_META[id].shortLabel` / `.nativeName`, and the only comparison is
 * between two variables. Adding or dropping a locale is a `src/i18n/routing.ts`
 * edit and this file does not move (INV-02.9, INV-04.12). The retired
 * `common.localeSwitcher.label` — the two-name "{current} · {other}" template —
 * is read by nothing; the two strings this component uses are `ariaLabel` for
 * the control and `optionAriaLabel` per option.
 *
 * **`variant="nav"` is a native `<details>` disclosure, not a `role="menu"`.**
 * `D-04.16` settles both halves: a disclosure opens and closes with no
 * JavaScript, which the two-name toggle got for free and a `useState` dropdown
 * would lose; and the options are links to URLs rather than application
 * commands, so `role="menu"` would promise arrow-key and typeahead semantics
 * that would then have to be implemented against the grain of a list of links.
 * The arrow keys below move focus *within* the open list without claiming that
 * role — every option stays an ordinary tab stop, so nothing is taken away from
 * a reader who tabs.
 *
 * **The trigger carries no chevron** (ADJ-20): its visible content is the
 * fixed-width `shortLabel` and nothing else, which is also what keeps the nav
 * row from reflowing when the locale changes (03 §3.3's CLS budget — the three
 * endonyms differ in width, the three short labels sit in one fixed box).
 *
 * **`variant="sheet"` has no disclosure at all**: the same three links render
 * as flat rows inside `MobileMenu`, wrapped in a `<ul>` that carries the
 * control's `aria-label` — there is no trigger there to name the group.
 *
 * **What a click does** (05 §5.6, 06 `D-06.9`): `preventDefault`, mark the
 * reveal registry so the next tree's already-seen blocks replay as the locale
 * cascade, then one `router.replace` that keeps the path, the query and the
 * hash and does not scroll. The `Link` underneath is the no-JavaScript path and
 * is what writes the `NEXT_LOCALE` cookie.
 */

/**
 * 05 §5.6 asks for a root cross-fade over `--dur-word-swap` on top of the
 * cascade, via React's transition types. The type is passed here because it
 * costs nothing and `view-transitions.css` is already written for it — but a
 * locale switch is a plain client navigation that no `<ViewTransition>`
 * boundary opts into (`PageTransition` maps everything but the two subpage
 * types to `"none"`), so no view transition starts and the cross-fade does not
 * play. The cascade is the whole of the visible motion, by design and in fact.
 */
const LOCALE_SWAP_TRANSITION = ["locale-swap"];

export type LangSwitcherVariant = "nav" | "sheet";

export type LangSwitcherProps = {
  readonly variant: LangSwitcherVariant;
  /** 06 `D-06.9`'s sketch passes it; `useLocale()` is the fallback. */
  readonly current?: Locale;
};

const TRIGGER_CLASS =
  "flex min-h-(--tap-min) w-10 cursor-pointer list-none items-center justify-center rounded-card-sm font-body text-lang-toggle font-bold text-muted transition-colors duration-(--dur-word-swap) ease-soft select-none hover:text-forest [&::-webkit-details-marker]:hidden";

const PANEL_CLASS =
  "absolute end-0 z-50 mt-2 flex min-w-44 flex-col rounded-card bg-nav-bg p-1 shadow-nav";

const OPTION_CLASS =
  "flex min-h-(--tap-min) items-center rounded-card-sm px-3 font-body text-lang-toggle text-nav-link transition-colors duration-(--dur-word-swap) ease-soft hover:text-forest";

const SHEET_LIST_CLASS = "flex flex-col";

const SHEET_OPTION_CLASS =
  "flex min-h-(--tap-min) items-center font-body text-nav text-nav-link transition-colors duration-(--dur-word-swap) ease-soft hover:text-forest";

/** The current row is marked twice: by `aria-current` and, visibly, by weight. */
function optionWeight(isCurrent: boolean): string {
  return isCurrent ? "font-extrabold text-forest" : "font-bold";
}

/** Every focusable option inside one list, in DOM order. */
function optionsOf(list: HTMLElement | null): HTMLAnchorElement[] {
  return list === null ? [] : [...list.querySelectorAll<HTMLAnchorElement>("a[href]")];
}

/**
 * Arrow-key movement inside the option list. Not a `role="menu"` roving
 * tabindex — every option keeps its own tab stop — just the focus movement a
 * reader expects from a vertical list, plus `Home` / `End`.
 */
function moveFocus(list: HTMLElement | null, key: string): boolean {
  const options = optionsOf(list);
  if (options.length === 0) return false;

  const active = document.activeElement;
  const index = options.findIndex((option) => option === active);

  const target =
    key === "Home"
      ? 0
      : key === "End"
        ? options.length - 1
        : key === "ArrowDown"
          ? (index + 1) % options.length
          : key === "ArrowUp"
            ? (index <= 0 ? options.length : index) - 1
            : -1;

  if (target < 0) return false;
  options[target]?.focus();
  return true;
}

export function LangSwitcher({ variant, current }: LangSwitcherProps) {
  const activeLocale = useLocale();
  const currentLocale = current ?? activeLocale;
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();

  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  /**
   * The `<details>` is *controlled* by this state, which is what lets `Escape`,
   * an outside click and a chosen option close the panel without reaching into
   * the DOM. The browser still toggles the element natively — nothing here
   * calls `preventDefault` on the summary — and `onToggle` syncs the state
   * back, so the control keeps working with JavaScript switched off
   * (04 `D-04.16`(a)): the server renders `open={false}`, which emits no `open`
   * attribute at all.
   *
   * "The panel closes on navigation" needs no effect watching the pathname: the
   * only links in the panel are the options themselves, and the handler below
   * closes it before it navigates. A switch also re-mounts the `[locale]`
   * subtree (05 §5.6 depends on that), so the panel would come back closed even
   * if it did not.
   */
  const [open, setOpen] = useState(false);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) summaryRef.current?.focus();
  }, []);

  // An outside `pointerdown` closes the panel (04 `D-04.16`). It does not
  // return focus to the trigger: a pointer has already put focus where the
  // reader asked for it, and `Escape` is the path that restores it.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details === null) return;
      if (event.target instanceof Node && details.contains(event.target)) return;
      close(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  function onOptionClick(target: Locale) {
    return (event: ReactMouseEvent<HTMLAnchorElement>) => {
      // Let the browser have the modified clicks: a middle click or a
      // ⌘/ctrl-click means "open this in a new tab", and the `Link` underneath
      // is a real URL that does exactly that.
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      track("locale_toggle", { to: target });
      markLocaleSwap();
      close(false);

      // The only read of `window.location` in the app (06 §6.4, INV-06.8):
      // `usePathname()` returns the prefix-less pathname and nothing else, so
      // the query and the hash can only come from the live URL — and keeping
      // them is what makes a switch land the reader back where they were.
      const { search, hash } = window.location;
      router.replace(`${pathname}${search}${hash}`, {
        locale: target,
        scroll: false,
        transitionTypes: LOCALE_SWAP_TRANSITION,
      });
    };
  }

  /**
   * The keyboard contract, and the reason it hangs off the links rather than
   * off the list: the options are the interactive elements here, so this is
   * where a key press actually lands. `Escape` closes and — in the `nav`
   * variant — hands focus back to the trigger; the arrows and `Home` / `End`
   * move focus between options without a roving tabindex, so every option
   * stays an ordinary tab stop and nothing claims `role="menu"` semantics
   * (04 `D-04.16`(b)).
   */
  function onOptionKeyDown(event: ReactKeyboardEvent<HTMLAnchorElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(variant === "nav");
      return;
    }
    if (moveFocus(listRef.current, event.key)) event.preventDefault();
  }

  function renderOptions(optionClass: string): ReactNode {
    return routing.locales.map((target) => {
      const isCurrent = target === currentLocale;
      const meta = LOCALE_META[target];

      return (
        <li key={target}>
          <Link
            href={pathname}
            locale={target}
            hrefLang={meta.hreflang}
            aria-current={isCurrent ? "true" : undefined}
            aria-label={t("localeSwitcher.optionAriaLabel", { locale: meta.nativeName })}
            className={`${optionClass} ${optionWeight(isCurrent)}`}
            onClick={onOptionClick(target)}
            onKeyDown={onOptionKeyDown}
          >
            {meta.nativeName}
          </Link>
        </li>
      );
    });
  }

  if (variant === "sheet") {
    return (
      <ul ref={listRef} aria-label={t("localeSwitcher.ariaLabel")} className={SHEET_LIST_CLASS}>
        {renderOptions(SHEET_OPTION_CLASS)}
      </ul>
    );
  }

  return (
    <details
      ref={detailsRef}
      className="relative"
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary
        ref={summaryRef}
        aria-label={t("localeSwitcher.ariaLabel")}
        className={TRIGGER_CLASS}
        onKeyDown={(event: ReactKeyboardEvent<HTMLElement>) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          close(false);
        }}
      >
        {LOCALE_META[currentLocale].shortLabel}
      </summary>
      <ul ref={listRef} className={PANEL_CLASS}>
        {renderOptions(OPTION_CLASS)}
      </ul>
    </details>
  );
}
