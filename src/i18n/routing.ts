import { defineRouting } from "next-intl/routing";

/**
 * The single place locales and their metadata are declared (02 `D-02.1`,
 * 06 §6.3). Every doc, component and test reads them from here — nothing else
 * in the tree may write a locale id.
 *
 * Three ids exist in the contract: `en` (default and reference), `zh-Hans`
 * (Simplified — ships at launch) and `zh-Hant` (Traditional). The plain
 * identifier `zh` exists nowhere. The locale id, the URL segment, the
 * `<html lang>` value and the `hreflang` value are the *same string*, so there
 * is no short-code ↔ tag mapping to drift.
 */

/**
 * Every locale id the project knows about, **enabled or not**.
 *
 * `routing.locales` below is the enabled subset. Since PR-3.9 seeded
 * `content/zh-Hant/` and turned the id on, the two lists are equal — but they
 * are still two lists, because INV-02.11 keeps a locale out of
 * `routing.locales` until it is complete and D-10.12 may take `zh-Hant` back
 * out at the Phase 8 gate. The catalogue is what lets `ACCEPT_LANGUAGE` name a
 * held-back id as a *preference* (`D-06.15`(a)) — which is what would send a
 * `zh-TW` reader to `zh-Hans` (the same language in the other script) rather
 * than to English on the day that happens.
 */
export const LOCALE_IDS = ["en", "zh-Hans", "zh-Hant"] as const;

/** A locale id from the catalogue — enabled or held back. */
export type LocaleId = (typeof LOCALE_IDS)[number];

/**
 * The locale cookie next-intl writes on an explicit switch (02 `D-02.9`,
 * 06 §6.3). One year, so a returning `zh-Hans` visitor who types the bare
 * domain lands on `/zh-Hans` (OQ-06.5). Functional, not tracking.
 */
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const routing = defineRouting({
  /**
   * The **enabled** locales, in menu order (02 `D-02.10`). A locale that is not
   * yet reviewed is absent (INV-02.11); this line plus the `LOCALE_META` row
   * below was the whole config half of PR-3.9, and removing `zh-Hant` from both
   * again is the D-10.12 fallback — together with its two `brand` values in
   * `content/site.json`, which INV-02.3 makes part of the same edit in both
   * directions (a localized value may carry an entry only for an enabled id).
   */
  locales: ["en", "zh-Hans", "zh-Hant"] as const satisfies ReadonlyArray<LocaleId>,
  defaultLocale: "en",
  /** 02 `D-02.9` / ADR-008: every page is `/en/…`, `/zh-Hans/…` or `/zh-Hant/…`. */
  localePrefix: "always",
  /**
   * Off on purpose: `hreflang` comes from route metadata only (02 `D-02.9`,
   * 06 `D-06.10`), so the `Link` header and the `<link rel="alternate">` tags
   * cannot disagree.
   */
  alternateLinks: false,
  localeCookie: { maxAge: LOCALE_COOKIE_MAX_AGE },
});

/** An **enabled** locale — the type behind `AppConfig['Locale']`. */
export type Locale = (typeof routing.locales)[number];

/**
 * Per-locale metadata (02 *Design → Locales*, 06 §6.3).
 *
 * `LOCALE_META` carries no `dir`: all locales here are left-to-right, so
 * `<html dir="ltr">` is a constant and a field that is always `"ltr"` would be
 * configuration nobody maintains (06 `D-06.9`).
 */
export type LocaleMeta = {
  /** `<html lang>` — the locale id verbatim (02 `D-02.1`). */
  readonly htmlLang: string;
  /** The `hreflang` value — the locale id verbatim (02 `D-02.1`). */
  readonly hreflang: string;
  /** Open Graph wants `xx_YY`, not a BCP 47 tag (06 §6.3, OQ-06.8). */
  readonly ogLocale: string;
  /** The endonym shown in the language menu (02 `D-02.10`). */
  readonly nativeName: string;
  /** The compact nav-trigger label (02 `D-02.10`). */
  readonly shortLabel: string;
  /**
   * The locale whose brand name the bilingual footer shows beside the current
   * one (02 `D-02.19`). Configuration, not a locale branch — INV-02.9 holds.
   */
  readonly brandPairLocale: Locale;
};

/**
 * One row per **enabled** locale; PR-3.9 added the `zh-Hant` row.
 *
 * The endonyms distinguish the two Chinese locales — "中文" alone is ambiguous
 * now that both ship — and each is written in its own script. These names are
 * data, never message keys, so adding a locale writes them once (02 rule 11).
 */
export const LOCALE_META = {
  en: {
    htmlLang: "en",
    hreflang: "en",
    ogLocale: "en_US",
    nativeName: "English",
    shortLabel: "EN",
    brandPairLocale: "zh-Hans",
  },
  "zh-Hans": {
    htmlLang: "zh-Hans",
    hreflang: "zh-Hans",
    ogLocale: "zh_CN",
    nativeName: "简体中文",
    shortLabel: "简",
    brandPairLocale: "en",
  },
  "zh-Hant": {
    htmlLang: "zh-Hant",
    hreflang: "zh-Hant",
    ogLocale: "zh_TW",
    nativeName: "繁體中文",
    shortLabel: "繁",
    brandPairLocale: "en",
  },
} as const satisfies Record<Locale, LocaleMeta>;

/**
 * `Accept-Language` → locale (02 *Design → Routing*, 06 `D-06.15`(a)).
 *
 * Browsers send `zh-CN` / `zh-TW` and rarely a script subtag, and best-fit
 * lookup truncates `zh-CN` to `zh` — which matches neither `zh-Hans` nor
 * `zh-Hant`, so unaided negotiation would send every Chinese reader to English.
 *
 * Each row is an **ordered preference chain filtered by `routing.locales`,
 * first survivor wins**. Now that PR-3.9 has enabled `zh-Hant`, row 2 resolves
 * to it; while it was held back the same row resolved to `zh-Hans`, and it will
 * again if D-10.12's fallback fires — never to `en`, in either state. A tag no
 * row matches is skipped; a header no row matches at all is left alone for
 * next-intl's own best fit.
 *
 * Row 3 is 02's third table row (`en-*` → `en`) written out rather than left
 * implicit, and it is load-bearing: the resolver walks the header **in q-order**
 * and takes the first tag that matches a row, so without it `en-US,zh-CN;q=0.8`
 * would step past the reader's actual first choice and serve Chinese.
 */
export const ACCEPT_LANGUAGE: ReadonlyArray<readonly [RegExp, readonly LocaleId[]]> = [
  // zh, zh-CN, zh-SG, zh-MY, zh-Hans, zh-Hans-* — Simplified regions.
  [/^zh(-(CN|SG|MY|Hans(-.*)?))?$/i, ["zh-Hans", "zh-Hant"]],
  // zh-TW, zh-HK, zh-MO, zh-Hant, zh-Hant-* — Traditional regions.
  [/^zh-(TW|HK|MO|Hant(-.*)?)$/i, ["zh-Hant", "zh-Hans"]],
  // en, en-* — the default locale, claimed explicitly so it wins on q-order.
  [/^en(-.*)?$/i, ["en"]],
];
