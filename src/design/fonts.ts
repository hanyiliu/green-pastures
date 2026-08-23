/**
 * The two brand faces, loaded and self-hosted by `next/font/google`
 * (03 §3.1, `D-03.4`). This module is the whole font pipeline: there is no
 * `<link>` to Google, no font file in `public/`, and no runtime request.
 *
 * It declares exactly what 03 §3.1 prints and nothing else — same two faces,
 * same weights, same `display`, same custom-property names. The values are the
 * design's: `docs/design/README.md` L37–38 ("Headings: Fredoka … Body: Nunito")
 * for Fredoka 500/600 and Nunito 600/700, plus Nunito 800, which `D-03.4`
 * records as a deliberate addition because the desktop reference sets the Yelp
 * badge in `font:800` (desktop L240).
 *
 * **How the CSS reaches it.** `variable` makes next/font emit a class that
 * declares the custom property, so `--font-fredoka` / `--font-nunito` exist
 * only on elements carrying `fredoka.variable` / `nunito.variable`. Both belong
 * on `<html>` in the locale layout — `<html lang={locale}
 * className={`${fredoka.variable} ${nunito.variable}`}>` (03 §3.1, 06 §6.2).
 * `src/styles/tokens.css` §3.1 then reads them: `--font-display` is
 * `var(--font-fredoka), var(--font-cjk)` and `--font-body` is
 * `var(--font-nunito), var(--font-cjk)`. Until the classes are on the element
 * those two tokens fall straight through to `--font-cjk`, which is the system
 * stack — legible, and not the brand.
 *
 * **No CJK face is loaded here, by decision** (`D-03.5`, confirmed by HD-14,
 * closing OQ-03.4). The design names no Chinese typeface, so there is none to
 * reproduce; `next/font/google` could not scope one per script anyway (no
 * `unicode-range` option, memo ADJ-6). The Simplified and Traditional stacks
 * are `--font-cjk-sc` / `--font-cjk-tc` in `src/styles/tokens.css`, and
 * `:root:lang(zh-Hans)` / `:root:lang(zh-Hant)` pick between them (`D-03.14`).
 * Adding a webfont for either script here would reverse a settled decision.
 *
 * The reference's Google Fonts `<link>` also requests Nunito 400/italic,
 * Quicksand and Baloo 2. Those belong to the brand-kit exploration panel, are
 * not tokens, and are deliberately absent below (03 §3.1).
 */
import { Fredoka, Nunito } from "next/font/google";

/**
 * Fredoka 500 (buttons, the pull-quote) and 600 (headings, names, day chips) —
 * the display face behind `--font-display` (03 §3.1).
 */
export const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--font-fredoka",
});

/**
 * Nunito 600 (body), 700 (eyebrows, links, labels) and 800 (the Yelp badge) —
 * the text face behind `--font-body` (03 §3.1).
 */
export const nunito = Nunito({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  variable: "--font-nunito",
});
