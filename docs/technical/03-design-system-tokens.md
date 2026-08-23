# 03 · Design system & tokens

**Purpose.** This document turns the design handoff (`docs/design/README.md`, `docs/design/desktop/README.md`,
`docs/design/mobile/README.md`, with the `.dc.html` references consulted only for values the READMEs omit) into
the single token vocabulary the codebase will use: colours, typography, spacing, shape, elevation, touch targets
and motion timing. It fixes the token **names and values**, how they are declared in Tailwind CSS v4 `@theme`,
how they are mirrored into TypeScript for Motion, how the two Chinese locales (`zh-Hans`, `zh-Hant`) change
typography, how the two design
widths (1280 / 390) become breakpoints, and which token pairs fail WCAG contrast. It does not describe components
(04), how motion tokens are sequenced (05), or the i18n message contract (02).

Status: draft · seat writer-tokens · 2026-08-22 · revised 2026-08-22 for HD-10 (three locales, per-script CJK
stacks), HD-11 (the designs name no CJK typeface — false premise recorded, system stack stands) and HD-14
(the human confirmed that system stack for both scripts — OQ-03.4 answered, no CJK webfont at launch)

## Decisions

- **D-03.1 — One token source.** All design tokens are CSS custom properties declared in one file,
  `src/styles/tokens.css` (imported by `src/app/globals.css`): namespaced tokens inside a Tailwind v4
  `@theme static` block, and — because Tailwind v4 has no `--duration-*` namespace (memo ADJ-5) — the
  `--dur-*` / `--stagger-*` / `--section-*` / `--tap-*` tokens in a sibling `:root` block. Stack per memo
  ADR-001 + ADJ-1: Next.js 16.x (App Router), React 19.2, Node 24, Tailwind CSS v4, Motion.
  The names in this document are canonical; no component, CSS Module, or doc introduces a second spelling.
- **D-03.2 — Naming.** `--color-*`, `--font-*`, `--text-*` (+ `--text-*--line-height`), `--tracking-*`,
  `--radius-*`, `--shadow-*`, `--container-*`, `--breakpoint-*`, `--ease-*` follow Tailwind v4's namespaces
  so they become utilities automatically; `--dur-*`, `--stagger-*`, `--section-*`, `--tap-*` are plain
  custom properties consumed via `var()` / Tailwind's `(--var)` shorthand. Section-scoped colours are named by
  role, not by hue: `--color-accent-programs`, not `--color-orange`.
- **D-03.3 — TS mirror for JS-consumed values.** `src/design/tokens.ts` exports the motion tokens (easings as
  number arrays, durations in **seconds**, stagger, `REVEAL_THRESHOLD`) and the two breakpoints. A Vitest test
  (wired by 08) parses `tokens.css` and asserts the mirror equals the CSS values (ms ÷ 1000).
- **D-03.4 — Fonts via `next/font/google`** (Next.js 16.x). Fredoka 500/600 and Nunito 600/700 as the design
  states (README L37), plus Nunito 800 — a choice, because the reference's Yelp badge uses `font:800`
  (desktop L240). `display: "swap"`, `subsets: ["latin"]`, exposed as `--font-fredoka` / `--font-nunito`;
  `@theme` maps them to `--font-display` and `--font-body`.
- **D-03.5 — CJK strategy: the system stack, because the design names no CJK face (HD-11, confirmed by
  HD-14).** The premise that there is "a CJK typeface used in the designs" is false — the handoff specifies
  Fredoka and Nunito (`docs/design/README.md` L37), neither of which carries CJK glyphs, so the system CJK
  stack (`--font-cjk`) *is* what the prototypes already render (§3.1, *Why there is no CJK design face*).
  Mechanism: `next/font/google` cannot assign a face per script (no `unicode-range` option, memo ADJ-6), so
  the fallback is a **font-family stack** — Fredoka/Nunito first (Latin letters and digits inside Chinese copy
  stay in brand type), then `--font-cjk`, which resolves per script (D-03.14). **No CJK web font ships at
  launch: HD-14 (2026-08-22) confirmed this stack for both Chinese scripts and closed OQ-03.4.** Naming a face
  later is still a one-token change, but it is now a future brand choice, not a pending answer. The Chinese
  line-height, tracking and wrapping overrides are declared once under `:root:lang(zh)` (§3.3).
- **D-03.6 — Breakpoints.** Mobile-first. Token values switch from the mobile spec to the desktop spec at
  `--breakpoint-md: 48rem` (768px); 04 enables the desktop multi-column layouts at `--breakpoint-lg: 64rem`
  (1024px) — see §8; content containers cap at the desktop design width (`--container-page: 80rem`). No third type scale is
  invented for tablets: 768–1023px renders the desktop type/padding in the mobile column structure.
- **D-03.7 — One shadow set.** The mobile reference shortens several shadows by ~15% (e.g. polaroid
  `0 10px 22px` vs `0 12px 26px`). We ship one token set using the desktop values on both views; the motion
  and shape tokens are already identical per `docs/design/mobile/README.md`.
- **D-03.8 — Emoji stay at launch.** 🌱🍎🌿🥦🌾🧸🎨 remain the icon language (design README "Assets" leaves
  this open). They render through `--font-emoji` inside fixed-size containers and are `aria-hidden` unless
  they carry meaning (04 owns the `Emoji` component). Swapping to an icon set is OQ-03.5.
- **D-03.9 — Logo.** `docs/design/assets/logo.png` (373×161 px, RGBA PNG, 33.7 KB; the three copies under
  `docs/design/**/assets/` are byte-identical) is copied to `public/brand/logo.png` and always sits on white
  or cream — on the forest footer it lives inside the white logo card.
- **D-03.10 — No dark mode.** The design defines one light theme; no `prefers-color-scheme` handling, no
  `dark:` variants, no `[data-theme]`. Reopening this requires a design, not a flag.
- **D-03.11 — Focus ring.** The references define no focus styles. We add one global `:focus-visible` style:
  `outline: 3px solid var(--color-focus); outline-offset: 3px`, with `--color-focus` = forest on light
  sections and sun on the forest Visit section (both ≥ 5:1 against their ground, §10).
- **D-03.12 — Design values are the tokens; AA fixes are proposals.** Every colour token holds the value the
  design states. Pairs that miss WCAG AA are listed in §10 with a computed ratio and a proposed replacement;
  the replacements are adopted only when OQ-03.2 is answered. Until then components use the design value.
- **D-03.13 — Ownership.** 03 owns token names and values. 05 owns how motion tokens are sequenced, staggered
  and reduced-motion-gated. 04 owns components and which token each surface uses. 02 owns strings — no token
  ever contains copy.
- **D-03.14 — `--font-cjk` resolves per script (HD-10; requirement from 02 D-02.15).** Three locales ship —
  `en`, `zh-Hans`, `zh-Hant` (02 D-02.1) — and the two Chinese scripts want different system faces: setting
  Traditional copy in `PingFang SC` or `Microsoft YaHei` renders Simplified glyph forms for the code points
  the two scripts share, which is a wrong-language rendering, not a style preference. `tokens.css` therefore
  declares two script stacks — `--font-cjk-sc` and `--font-cjk-tc` (§3.1) — plus one selector token
  `--font-cjk`, switched by exactly two rules, `:root:lang(zh-Hans)` and `:root:lang(zh-Hant)`.
  `--font-display` and `--font-body` never change, no component branches on locale (INV-03.6, 02 INV-02.9),
  and the base value of `--font-cjk` stays the SC stack: on an `en` page it is reached only for glyphs
  Fredoka/Nunito lack (`←` `→` `↗` `★`, §3.1), which are script-neutral.

## Design

### 1 · Token naming and Tailwind v4 mapping

Tailwind v4 turns `@theme` variables into utilities by namespace; utilities reference the variable
(`background-color: var(--color-sage)`), so overriding a variable inside a scope (`:lang(zh)`, a media
query, a section wrapper) re-themes every utility that uses it without new classes. `@theme static` keeps
every token in the emitted CSS even if no utility uses it, so runtime `getComputedStyle` reads and the
parity test see the same values.

| Namespace (CSS) | Utility it yields | Example |
|---|---|---|
| `--color-sage` | `bg-sage` `text-sage` `border-sage` `ring-sage` `fill-sage` | `bg-sage text-white` |
| `--font-display` | `font-display` | hero headline |
| `--text-headline` (+`--line-height`) | `text-headline` | `64px/1.04` desktop |
| `--tracking-eyebrow` | `tracking-eyebrow` | `1.5px` |
| `--radius-card` | `rounded-card` | `18px` |
| `--shadow-card-warm` | `shadow-card-warm` | testimonial card |
| `--container-content` | `max-w-content` | `1080px` |
| `--breakpoint-md` | `md:` variant | `48rem` |
| `--ease-soft` | `ease-soft` | `cubic-bezier(.2,.8,.25,1)` |
| `--dur-rise` (plain) | `duration-(--dur-rise)` | `750ms` |

```css
/* src/styles/tokens.css — excerpt, illustrative */
@import "tailwindcss";
@theme static {
  --color-sage: #6f8a5f;   --color-forest: #3f5538;  --color-cream: #fbf8f0;
  --color-ink: #34402c;    --color-body: #6b7060;    --color-chip-bg: #eef2e8;
  --color-bg-philosophy: #e8efe0;  --color-accent-programs: #c08552;
  --font-display: var(--font-fredoka), var(--font-cjk);
  --font-body: var(--font-nunito), var(--font-cjk);  --font-cjk: var(--font-cjk-sc);  /* §3.1 */
  --text-headline: 36px;  --text-headline--line-height: 1.08;   /* mobile first */
  --radius-pill: 999px;  --radius-card: 18px;  --shadow-primary: 0 10px 24px rgba(111,138,95,.32);
  --ease-soft: cubic-bezier(.2,.8,.25,1);  --ease-spring: cubic-bezier(.34,1.56,.5,1);
  --breakpoint-md: 48rem; --breakpoint-lg: 64rem; --container-page: 80rem;
}
:root { /* Tailwind v4 has no --duration-* namespace (ADJ-5): plain custom properties */
  --dur-rise: 750ms; --dur-ink: 950ms; --dur-polaroid: 800ms; --dur-visit-fade: 1100ms;
  --dur-subpage: 500ms; --dur-word-swap: 200ms; --stagger-child: 110ms;
  --dur-leaf: 8s; --dur-sun: 9s; --dur-cue: 2s; --dur-countup: 1000ms;
  /* --reveal-threshold: 0.16 is a JS constant (REVEAL_THRESHOLD in tokens.ts), not CSS */
}
@media (width >= 48rem) { :root { --text-headline: 64px; --text-headline--line-height: 1.04; } }
:root:lang(zh) { --text-headline--line-height: 1.3; --tracking-eyebrow: .08em; }   /* both scripts, §3.3 */
:root:lang(zh-Hans) { --font-cjk: var(--font-cjk-sc); }   /* stacks in §3.1 */
:root:lang(zh-Hant) { --font-cjk: var(--font-cjk-tc); }
```

What Tailwind generates, honestly: `--ease-soft` → `ease-soft`; `--color-*`, `--font-*`, `--text-*`, `--radius-*`,
`--shadow-*`, `--container-*`, `--breakpoint-*` → their utilities; `--dur-*` yields **no** `duration-rise`
utility — it is consumed as `duration-(--dur-rise)`, `[transition-duration:var(--dur-rise)]`, in CSS Modules
as `var(--dur-rise)`, or from the TS mirror in Motion. Per-view values (§3, §4) are declared mobile-first and
re-declared under `@media (width >= 48rem)`. Per-locale values sit in three rules and nowhere else:
`:root:lang(zh)` for everything both Chinese scripts share (§3.3) — CSS language-range matching makes
`:lang(zh)` match `zh-Hans` and `zh-Hant` alike — and `:root:lang(zh-Hans)` / `:root:lang(zh-Hant)` for the
one thing that differs, `--font-cjk` (D-03.14). `--font-cjk-sc` / `--font-cjk-tc` do generate `font-cjk-sc` /
`font-cjk-tc` utilities; components must never use them (INV-03.6). Components never write `md:text-[64px]`;
they write `text-headline`.

### 2 · Colour tokens

Source lines: `docs/design/README.md` L30–34 unless stated. `.dc.html` references are cited as `desktop LNN`
(= `docs/design/desktop/Green Pastures - Homepage.dc.html`) or `mobile LNN`.

**2.1 Brand and neutrals**

| Token | Hex | Role | Source |
|---|---|---|---|
| `--color-sage` | `#6f8a5f` | primary: buttons, HEAD TEACHER badge, hero accent word | README L30 |
| `--color-forest` | `#3f5538` | Visit section bg, nav hover text | README L30; desktop/README L26 |
| `--color-forest-panel` | `#35492f` | Visit info panel | README L30 |
| `--color-sun` | `#f4c64e` | sun SVG fill, Visit focus ring | README L31 |
| `--color-amber` | `#f0a93a` | star glyphs | README L31 |
| `--color-daychip-selected` | `#e0a93a` | selected day chip bg (README's "selected chip"; same token in §2.4) | README L31 |
| `--color-peach` | `#e8a87c` | reserved (brand kit; unused on homepage) | README L31 |
| `--color-cream` | `#fbf8f0` | page bg, hero bg, input bg, nav tint base | README L32 |
| `--color-ink` | `#34402c` | headings, names, selected-text fallback | README L32 |
| `--color-body` | `#6b7060` | body copy, trust row, form labels | README L32 |
| `--color-muted` | `#8a8170` | lang toggle, meals-card sub line | README L32 |
| `--color-muted-2` | `#a89e8a` | placeholders, scroll cue | README L32 |
| `--color-chip-bg` / `--color-chip-text` | `#eef2e8` / `#4f6b43` | sage chips, hero badge, hero/philosophy links | README L34 |
| `--color-yelp` | `#d3402e` | Yelp badge / button | README L34 |
| `--color-accent-teachers` / `--color-link-teachers` | `#8677a3` / `#6d5f92` | Teachers accent (eyebrow, role lines) / Teachers link — README's "Teachers accent" / "link"; canonical §2.3 names, no hue-named alias | README L34 |
| `--color-nav-link` | `#4a5040` | desktop nav links | desktop L100 |
| `--color-divider` | `#e2dccf` | nav/trust dividers, input border (1.5px) | desktop L103, L317 |
| `--color-footer-rule` | `#4f6645` | footer top border on forest | desktop L337 |
| `--color-white` | `#ffffff` | cards, rings, polaroid frames, text on forest | throughout |

**2.2 Section backgrounds (scroll order, README L33)**

| Order | Token | Hex | Order | Token | Hex |
|---|---|---|---|---|---|
| 1 | `--color-bg-hero` | `#fbf8f0` | 5 | `--color-bg-gallery` | `#eaf0f1` |
| 2 | `--color-bg-philosophy` | `#e8efe0` | 6 | `--color-bg-testimonials` | `#f6ece4` |
| 3 | `--color-bg-programs` | `#f7ecdd` | 7 | `--color-bg-teachers` | `#f0edf4` |
| 4 | `--color-bg-menu` | `#fbf2db` | 8 | `--color-bg-visit` | `#3f5538` |

**2.3 Per-section accents** — eyebrow (Nunito 700 13px, `letter-spacing:1.5px`, uppercase), link text,
link underline (2px bottom border), subhead/blurb colour. The README states the rule ("section accent
color"); the values come from the desktop reference (mobile is identical). The names `--color-accent-<section>`,
`--color-link-<section>`, `--color-link-underline-<section>`, `--color-sub-<section>` (suffix = section id: hero,
philosophy, programs, menu, gallery, testimonials, teachers, visit) are the **canonical** tokens for every
section-scoped colour; the README's hue labels (Teachers accent/link, selected chip) map onto them in §2.1/§2.4,
and no hue-named alias (`--color-lavender*`, `--color-amber-chip`) exists (D-03.1, D-03.2).

| Section | `--color-accent-*` (eyebrow) | `--color-link-*` | `--color-link-underline-*` | `--color-sub-*` (subhead / blurb) | Source |
|---|---|---|---|---|---|
| hero | — (badge chip = chip tokens) | `#4f6b43` | `#c3d2b6` | `#6b7060` | desktop L115, L120 |
| philosophy | `#6f8a5f` | `#4f6b43` | `#b6c9a6` | attribution `#7e8a72`; quote mark `#c2d4b6` | desktop L143–146 |
| programs | `#c08552` (also age eyebrows) | `#b06a35` | `#e6bf95` | `#7d7468` | desktop L162–164 |
| menu | `#bd9326` | `#a8852f` | `#e6cf86` | `#897a4e` | desktop L189–191 |
| gallery | `#6f8a9a` | `#56707e` | `#b4c8d0` | `#6f7a80` | desktop L218–220 |
| testimonials | — (stars `#f0a93a`) | `#c2553f` | `#e3b3a8` | quote `#5c5045`; attribution `#9a8578`; count `#8a7468` | desktop L238–271 |
| teachers | `#8677a3` (also role eyebrows) | `#6d5f92` | `#c3b7d6` | `#757080` | desktop L279–281 |
| visit | labels `#9bb78c` | footer links `#c8d6bd` | — | subhead `#c8d6bd`; copyright `#8ba07c` | desktop L312–342 |

**2.4 Chips, badges, menu graphics, decorations**

| Token | Value | Use | Source |
|---|---|---|---|
| `--color-daychip-text` | `#a89a72` on `#fff` | Mon–Fri chips (unselected) | desktop L200 |
| `--color-daychip-selected` (bg) + white text | `#e0a93a` / `#fff` | selected day chip (same token as §2.1) | desktop L202; README L31 |
| `--color-benefitchip-text` | `#897a4e` on `#fff` | vegetarian / allergy chips | desktop L209 |
| `--color-yelp-pill-bg` / `-text` | `#fff5db` / `#a8852f` | "★ 5.0 on Yelp" pill | desktop L74 |
| `--color-plate-ring` | `#fdf3da` (inset 10px; mobile 8px) | menu plate | desktop/README L13; mobile L124 |
| `--color-dot-breakfast` / `-lunch` / `-snack` | `#f6d98f` / `#a9c39a` / `#e8b79e` | plate dots | desktop L195–197 |
| `--color-dot-label-breakfast` / `-lunch` / `-snack` | `#bd9326` / `#5e7a4e` / `#bd7a55` | dot captions | desktop L195–197 |
| `--color-leaf-hero-1/2/3` | `#a9c39a` / `#e8c79a` / `#cdb38a` | hero leaves | desktop L111–113 |
| `--color-leaf-philosophy` / `-teachers` / `-visit` | `#9fbb8f` / `#c3b7d6` / `#7e9a6e` | section leaves | desktop L140, L276, L309 |
| `--color-quote-mark` | `#c2d4b6` | 84px decorative quote | desktop/README L11 |
| `--color-nav-bg` | `rgba(251,248,240,.92)` + `backdrop-filter: blur(6px)` | sticky nav | desktop/README L7 |
| `--color-focus` | `var(--color-forest)`; Visit: `var(--color-sun)` | focus ring (D-03.11) | ours |

### 3 · Typography

**3.1 Families and loading.** `src/design/fonts.ts`:

```ts
import { Fredoka, Nunito } from "next/font/google";
export const fredoka = Fredoka({ subsets: ["latin"], weight: ["500", "600"],
  display: "swap", variable: "--font-fredoka" });
export const nunito  = Nunito({ subsets: ["latin"], weight: ["600", "700", "800"],
  display: "swap", variable: "--font-nunito" });
// <html lang={locale} className={`${fredoka.variable} ${nunito.variable}`}>
```

**Why there is no CJK design face** (HD-11, confirmed by HD-14; recorded so the question is not re-asked). The
handoff was searched for a Chinese typeface and names none. `docs/design/README.md` L37 specifies "Headings:
Fredoka … Body: Nunito" and nothing else; the three design READMEs contain no CJK, Noto or PingFang mention at
all. Per `.dc.html` file, exactly — the desktop reference declares two families (`'Fredoka',cursive` and
`'Nunito',system-ui,sans-serif`) and its Google Fonts link (L13) additionally requests Quicksand and Baloo 2,
the brand-kit exploration faces; the **mobile** reference declares the same two families and its link (L13)
requests Fredoka and Nunito only — no Quicksand, no Baloo 2; and `docs/design/Wireframes.dc.html`, the low-fi
third file, uses neither of the brand faces, setting its text in `'Patrick Hand',cursive` throughout (204
declarations; its link also names Gaegu, which no rule in the file applies). Not one of those faces carries a Han ideograph, and the
wireframes' own `English · 中文` (L65) is itself set in Patrick Hand. The 中文 in all three prototypes is
therefore *already* drawn by whatever face the reader's operating system substitutes — PingFang SC on macOS,
Microsoft YaHei on Windows, Noto Sans CJK on most Linux and Android. There is nothing to reproduce and no face
to match: the system stack below is not a downgrade from the designs, it is a faithful reading of them, and
D-03.5 ships it. Naming a Chinese face would be a new brand choice, not the recovery of a lost one — and
HD-14 declined to make it for launch (OQ-03.4, answered 2026-08-22).

Glyph coverage: Google's `latin` subset (U+0000–00FF, U+2000–206F, U+2191/2193, …) covers `½ · — “ ”` but
**not** `←` `→` (U+2190/2192), `↗` (U+2197) or `★` (U+2605). In every "learn more →" link, the hero CTA, the
Yelp button and the star rows those glyphs render from the next face in the stack: first next/font's
metric-adjusted local Arial fallback (carries the arrows, not `★`), then `--font-cjk` — whichever script stack
is in force, since PingFang SC/TC, Microsoft YaHei/JhengHei and the Noto CJK builds all carry the arrows and
`★`. Accepted as is (no extra font, a choice); 04 keeps arrows and stars out of tracked eyebrow text, and 08's
per-OS visual snapshot at 390/1280 covers these glyphs.

| Token | Value | Note |
|---|---|---|
| `--font-display` | `var(--font-fredoka), var(--font-cjk)` | headings, quote, names, buttons, day chips |
| `--font-body` | `var(--font-nunito), var(--font-cjk)` | everything else |
| `--font-cjk-sc` | `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", sans-serif` | Simplified system stack: macOS · macOS legacy · Windows · Linux/Android · webfont names if one is ever added |
| `--font-cjk-tc` | `"PingFang TC", "Hiragino Sans CNS", "Microsoft JhengHei", "Noto Sans CJK TC", "Noto Sans TC", "Source Han Sans TC", sans-serif` | Traditional system stack, same shape, TC faces (D-03.14) |
| `--font-cjk` | base `var(--font-cjk-sc)`; `var(--font-cjk-tc)` under `:root:lang(zh-Hant)`, `var(--font-cjk-sc)` under `:root:lang(zh-Hans)` | the selector `--font-display`/`--font-body` fall through to (D-03.5, D-03.14) |
| `--font-emoji` | `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif` | emoji icons (D-03.8) |
| weights | Fredoka `500` (buttons, quote) / `600` (headings); Nunito `600` (body) / `700` (eyebrows, links, labels) / `800` (Yelp badge) | README L37–38; desktop L240 |
| `--tracking-eyebrow` / `--tracking-label` / `--tracking-stars` | `1.5px` / `.5px` / `1px` (count-up stars `2px`) | README L39; desktop L169, L238 |

Nunito 400/italic and the two extra display families in the reference's Google Fonts `<link>` belong to the
brand-kit exploration panel only; they are not tokens and are not loaded.

**3.2 Type scale** (`--text-*` + `--text-*--line-height`; desktop value ≥ `md`, mobile value below).
Sources: desktop/README L9–17, mobile/README L10–17; line numbers in the references where the READMEs omit a size.

| Token | Desktop | Mobile | Family/weight | Used for |
|---|---|---|---|---|
| `--text-headline` | `64px/1.04` | `36px/1.08` | Fredoka 600 | hero H1 |
| `--text-section-title` | `40px` (Reviews `36px`; Visit `42px/1.15`) | `28px` (Reviews `26px`; Visit `28px/1.2`) | Fredoka 600 | section H2 (desktop L163, L242, L311; mobile L98, L169, L224) |
| `--text-subhead` | `19px/1.6` hero; `17px/1.6` sections | `15px/1.6` hero; `13–14px/1.6` sections | Nunito 600 | under titles |
| `--text-quote` | `44px/1.32` | `26px/1.35` | Fredoka 500 | philosophy pull-quote |
| `--text-quote-mark` | `84px` | `58px` | Fredoka 600 | decorative “ (mobile L82) |
| `--text-program-title` | `23px` / `28px` (Toddler) | `20px` / `22px` | Fredoka 600 | stepping-stone titles |
| `--text-name-lg` / `--text-name` | `26px` / `21px` | `22px` / `17px` | Fredoka 600 | Ms. Ping / assistants |
| `--text-blurb` | `15px/1.6` head, `14px/1.55` assistants, `14px/1.5` programs | `13px` head/programs, `12px` assistants | Nunito 600 | teacher/program blurbs (mobile L103, L202, L208) |
| `--text-testimonial` | `16px/1.6`; name `14px`; attribution `12px` | `14px/1.6`; name `13px`; attribution `11px` | Nunito 600/700/600 | speech bubbles |
| `--text-eyebrow` | `13px` | `11px` | Nunito 700, uppercase, `--tracking-eyebrow` | section eyebrows (desktop L143; mobile L81) |
| `--text-eyebrow-sm` | `12px` (programs ages, roles), `11px` (assistant roles) | `10px` | Nunito 700, `--tracking-label` | age / role lines |
| `--text-nav` | `15px` | n/a (hamburger menu, not designed) | Nunito 700 | nav links |
| `--text-lang-toggle` | `14px` | — | Nunito 700 | locale switcher: the trigger (`EN`/`简`/`繁`) and its three menu options; the design's single "EN · 中文" item became a three-option menu (02 D-02.10), same size |
| `--text-button` | nav `16px`; hero `18px`; submit `17px` | nav `13px`; hero `17px`; submit `16px` | Fredoka 500 | pills (desktop L105, L119, L325; mobile L45, L58, L235) |
| `--text-chip` | hero badge `13px`; trust row `14px`; benefit `12px`; pills `11px`; day chips Fredoka `14px` | `11px`; `12px`; `12px`; `11px`; `13px` | Nunito 700 / Fredoka 600 | chips |
| `--text-sample-line` | `15px/1.6` | `13px` | Nunito 600 | menu sample meals |
| `--text-panel-label` / `--text-panel-value` | `12px` (1px tracking, uppercase) / `16px/1.5` | `10px` / `14px/1.5` | Nunito 700 / 600 | Visit info panel |
| `--text-form-label` / `--text-input` | `12px` / `14px` | `11px` / `14px` | Nunito 700 / 600 | form |
| `--text-footer-link` / `--text-copyright` | `14px` / `12px` | `12px` / `10px` | Nunito 700 / 600 | footer |
| `--text-scroll-cue` | `13px` | `12px` | Nunito 700, `.5px` | "scroll" cue |
| `--text-countup` | `30px` | `22px` | Fredoka 600 | "5.0" |

**3.3 Chinese typography — `zh-Hans` and `zh-Hant`** (declared once under `:root:lang(zh)`; `<html lang>` is
`LOCALE_META[locale].htmlLang` per 02 D-02.9, set by the `[locale]` layout, 06 wires it). Every value in this
list is our choice — the design specifies nothing for CJK (§3.1).

**One rule set, two scripts.** CSS language-range matching means `:lang(zh)` matches `zh-Hans` *and*
`zh-Hant` (and any later `zh-*`), so every rule below applies to both Chinese locales unchanged and neither is
special-cased. The **only** thing that differs by script is the font stack (D-03.14). Concretely: the raised
line-heights, the eyebrow tracking, the uppercase no-op and the wrapping rules are all script-neutral —
Traditional characters are denser (more strokes per em) than Simplified at the same size, which argues for the
same loosened leading, not for a second rule set.

- Stack: `--font-cjk` is already last in `--font-display`/`--font-body`, so CJK glyphs fall through while
  digits and Latin stay Fredoka/Nunito; `:root:lang(zh-Hant)` swaps `--font-cjk-sc` for `--font-cjk-tc`, and
  nothing else in the cascade moves. Weights: PingFang SC and PingFang TC both carry 600; Microsoft YaHei,
  Microsoft JhengHei and the Noto CJK system builds map 600→700 (synthesised or nearest bold).
- Sizes: unchanged. CJK glyphs are visually larger at the same px size, so no size bump is needed; if a
  translated headline wraps to an extra line at 390px, 02's translator guidance (not a token) shortens it.
- Line-height (choice, at or above 02 D-02.15's floor of ≥ 1.3 display / ≥ 1.6 body):
  `--text-headline--line-height: 1.3`, `--text-section-title--line-height: 1.3`,
  `--text-quote--line-height: 1.5`, body/blurb/testimonial `1.75` (vs the design's 1.6). Tight Latin leading
  clips CJK glyphs. The display values were 1.2 / 1.25 in the merged draft and are raised here to meet the
  floor 02 states; Traditional's stroke density is the second reason.
- Tracking (choice): `--tracking-eyebrow: .08em`; `text-transform: uppercase` is a no-op on CJK (the script
  has no case) and stays on the eyebrow recipe rather than being unset per locale, but must not be applied to
  mixed strings such as "ENGLISH · 中文" — 04 uses `uppercase` only via the eyebrow recipe.
- Wrapping: `word-break: normal; overflow-wrap: anywhere` on body text for CJK/Latin mixing; never
  `word-break: break-all`; no hyphenation. `text-wrap: balance` on headings (02 D-02.15) is declared in the
  heading recipe for **every** locale, not scoped to `:lang(zh)` — it is a line-count balancer, harmless in
  `en`, and it stops a two-line Chinese headline from stranding one glyph on the second line.
- **Switcher layout stability.** Per memo ADJ-4 the locale switcher — now a three-option menu, 02 D-02.10 — is
  a navigation that remounts the `[locale]` subtree and plays an enter-only cascade (`--dur-word-swap`,
  `--stagger-word`, 05), not a per-string in-place swap. Font metrics must still not cause jumps. What to
  measure, at 390 and 1280: (1) nav height and every section's height in `en` vs **each** Chinese locale
  (`zh-Hans` and `zh-Hant` are separate rows — different faces, different metrics), recorded by a Playwright
  snapshot (08) — where a section differs by more than one text line, 04 adds a `min-height` so the section
  the user is looking at does not move under the cascade; (2) CLS during the cascade via
  `PerformanceObserver('layout-shift')`, target **0** (budget ≤ 0.02) — the cascade animates only
  `opacity`/`transform`; (3) no font request on switch — every CJK face is a system face and Fredoka/Nunito
  are preloaded by `next/font`, so the cascade can never trigger FOUT; the Playwright check asserts no
  `fonts.gstatic`/`_next/static/media/*.woff2` request.

### 4 · Spacing and layout

| Token | Desktop (≥ md) | Mobile | Source |
|---|---|---|---|
| `--section-py` / `--section-px` | `70px` / `44px` | `48px` / `24px` | desktop/README L6; mobile/README L6 |
| hero section padding | `60px 44px 56px` | `36px 22px 40px` | desktop L110; mobile L50 |
| gallery horizontal padding | `44px` | `10px` (field bleeds) | mobile/README L6 |
| `--container-page` | `1280px` (design width; `80rem`) | `390px` design width, fluid | READMEs, first line |
| `--container-content` | `1080px` (range 980–1080; testimonials 1080, visit 1000, gallery field 980, hero column 760, hero subhead 540, quote 820, section subheads 560, sample line 580, hero photo 1040) | full width minus padding | desktop/README L6–17 |
| offsets / rotations | Toddler stone raised `34px`; middle bubble pushed down `30px`; Ms. Ping `300px` column, assistants `230px` columns offset `44px`; polaroids rotated `−6°…+6°` | polaroids `±2–6°`; alternating programs path | desktop/README L12–16; mobile/README L13–15 |
| button padding (`--btn-*`, vertical×horizontal) | nav pill `12×24`; hero CTA `15×32`; submit `14×30` | nav pill `10×16`; hero CTA and submit full-width, `15px` vertical | desktop/README L7, L10; desktop L325; mobile/README L8; mobile L45 |
| chip padding (`--chip-*`) | day chips `8×16` (selected `8×20`); benefit chips `8×14`; hero badge `7×15`; pills `6×12`; HEAD TEACHER `5×13`; Yelp badge `5×11` | day chips `9×13` (selected `9×16`); hero badge `6×13`; Yelp badge `4×9` | desktop/README L13; desktop L74, L115, L209, L240, L292; mobile/README L14; mobile L54, L130, L167 |
| nav logo / padding | `50px` logo, `18px 44px` padding, gap `20px`, link gap `26px` | `38px` logo, `10px 18px` | desktop/README L7; mobile/README L7; desktop L97–98; mobile L42–43 |
| `--nav-h` (sticky-nav height; 05's `scroll-margin-top`) | `86px` (= 50 + 2×18) | `58px` (= 38 + 2×10) | derived from the row above; 04 keeps nav content within the logo height or updates this token |
| grid gaps | programs cols `200/236/200` gap `44px`; testimonials `24px`; teachers `40px`; visit `1.2fr/1fr` gap `30px`, form 2-col `12px` | stacked; age/start 2-col row | desktop/README L10–17; mobile/README L17 |
| header stack | eyebrow→title→sub gap `12px`, margin-bottom `40–44px` | gap `9–10px`, margin-bottom `26–30px` | desktop L161; mobile L96 |
| component sizes | sun `118px`; leaves `40/28/22px`; plate `230px`, dots `46/56/46`; stones `150/188/150`; Ms. Ping photo `196px`; icon dots `56px`; polaroids `185–210px` wide, frame `10px + 30px` bottom; hero photo `1040×380`; philosophy photo `560×260`; info photo `150px` | sun `72px`; plate `190px`, dots `36/46/36`; stones `104/122/104`; Ms. Ping `150px`; icon dots `48px`; polaroids `146–160px`, frame `8px + 24px`; hero photo `230px` tall; philosophy `190px`; map `120px` | per-view READMEs |

### 5 · Shape and elevation

**Radii** (`--radius-*`, `rounded-*`). README L42 envelope: pills `999px`, cards `18–22px`, photos `14–26px`;
concrete steps: `pill 999px` · `card-lg 22px` (bubbles, philosophy photo) ·
`card 20px` (form card; mobile bubbles) · `card-md 18px` (panel, subpage cards; mobile form card) ·
`card-sm 16px` (meals card, desktop map photo; mobile `13px`) · `tile 14px` (icon tiles, mobile map photo) · `logo-card 12px`
(mobile `10px`) · `input 11px` · `badge 7px` (Yelp; mobile `6px`) · `tail 6px` (bubble corner; mobile `5px`)
· `polaroid 5px` · `full 50%`. Photos: hero `26px`, philosophy `22px`, mobile hero `22px`, mobile philosophy
`18px`, map/building photo `16px` desktop (desktop L328) / `14px` mobile (mobile L238) (README L42;
desktop/README L9–17; mobile/README L10–17).
Speech-bubble tails (one squared corner) are four-value radius tokens that switch per view:
`--radius-bubble-l: 22px 22px 22px 6px` (outer cards) and `--radius-bubble-r: 22px 22px 6px 22px` (the
pushed-down middle card, tail mirrored) at `≥ md` (desktop/README L15); below `md` `20px 20px 20px 5px` then
`20px 20px 5px 20px`, alternating per card (mobile/README L16) — `rounded-bubble-l` / `rounded-bubble-r`.

**Shadows** (`--shadow-*`). README L43 gives the envelope `0 10–20px 26–44px rgba(warm tint, .07–.18)`;
exact tints are from the desktop reference (line in parentheses).

| Token | Value | Use |
|---|---|---|
| `--shadow-primary` | `0 10px 24px rgba(111,138,95,.32)` | hero CTA (README L43) |
| `--shadow-primary-sm` | `0 8px 18px rgba(111,138,95,.3)` | nav "Book a tour" (L105) |
| `--shadow-badge` | `0 6px 14px rgba(111,138,95,.35)` | HEAD TEACHER badge (L292) |
| `--shadow-submit` | `0 10px 22px rgba(60,80,50,.25)` | "Request a tour" on forest (L325) |
| `--shadow-nav` | `0 4px 16px rgba(60,50,40,.06)` | sticky nav (L97) |
| `--shadow-float` | `0 12px 30px rgba(60,50,40,.16)` | floating meals card (L130) |
| `--shadow-stone` / `--shadow-stone-lg` | `0 14px 30px rgba(90,70,40,.13)` / `0 20px 42px rgba(90,70,40,.18)` | program rings; Toddler (L168, L173) |
| `--shadow-plate` | `0 18px 40px rgba(120,100,40,.16), inset 0 0 0 10px #fdf3da` | menu plate (L194) |
| `--shadow-chip-gold` / `--shadow-chip-gold-md` | `0 3px 10px rgba(120,100,40,.06)` / `0 4px 12px rgba(120,100,40,.08)` | day chips; benefit chips (L200, L209) |
| `--shadow-chip-amber` | `0 6px 14px rgba(224,169,58,.35)` | selected day chip (L202) |
| `--shadow-polaroid` | `0 12px 26px rgba(60,70,90,.16)` | gallery frames (L223) |
| `--shadow-chip-cool` | `0 3px 10px rgba(60,70,90,.07)` | gallery filter chips (L492) |
| `--shadow-card-warm` / `-lg` | `0 12px 30px rgba(120,80,50,.08)` / `0 14px 32px rgba(120,80,50,.10)` | review cards; homepage bubbles (L523, L246) |
| `--shadow-card-lavender` / `--shadow-dot-lavender` / `--shadow-ring-lavender` | `0 12px 30px rgba(90,80,120,.10)` / `0 10px 24px rgba(90,80,120,.13)` / `0 20px 42px rgba(90,80,120,.18)` | teacher cards / icon dots / Ms. Ping ring (L567, L285, L291) |
| `--shadow-card-sage` | `0 10px 26px rgba(60,80,50,.07)` | philosophy principle cards (L361) |
| `--shadow-yelp` | `0 10px 22px rgba(211,64,46,.3)` | Yelp button (L544) |
| `--shadow-subnav` / `--shadow-back` | `0 3px 12px rgba(60,50,40,.05)` / `0 4px 12px rgba(60,50,40,.08)` | subpage sticky bar / back pill (L350–351) |

Hover (desktop only, desktop/README L26): primary buttons `translateY(-1px)` + deeper shadow; we do not add a
hover shadow token — 04 reuses `--shadow-primary` at rest and `--shadow-primary-sm`→`--shadow-primary` on hover.

### 6 · Touch targets and focus

Touch targets ≥ 44px: `--tap-min: 44px` (mobile/README L8). Inputs `46px` mobile / `44px` desktop (`--input-h`), radius
`--radius-input`, border `1.5px solid var(--color-divider)`, bg `--color-cream`; mobile CTAs full-width with
`15px` vertical padding; day chips (`9px 13px` mobile) are under 44px tall by design — 04 extends the hit area
with padding/pseudo-element, not by changing the visual. Focus: D-03.11; the ring follows `border-radius`.

### 7 · Motion tokens

Names and values are fixed here and used verbatim by 05. The two `--ease-*` live in `@theme`; every `--dur-*`
and `--stagger-*` is a plain custom property in `:root` (ADJ-5). Ranges from `docs/design/README.md` L45–58
are recorded in the note; the token holds the chosen value.

| Token: value | Design note (README L45–58; desktop L19–27 keyframes) |
|---|---|
| `--ease-soft: cubic-bezier(.2,.8,.25,1)` | SOFT |
| `--ease-spring: cubic-bezier(.34,1.56,.5,1)` | SPRING |
| `--dur-rise: 750ms` | pick inside ".7–.8s SOFT" (midpoint); section header rise-in from `translateY(26px)` |
| `--dur-ink: 950ms` | philosophy quote "inks in" from `blur(14px) scale(.97)` (.95s) |
| `--dur-polaroid: 800ms` | gallery fly-in, `.8s SPRING` |
| `--dur-visit-fade: 1100ms` | Visit "slow 1.1s fade" |
| `--dur-subpage: 500ms` | subpage slide `.5s SOFT` (reference uses `.55s` desktop / `.5s` mobile) |
| `--dur-word-swap: 200ms` | locale-switch cascade (the design's EN↔中文 swap) "~200ms fade + 6px rise" |
| `--stagger-child: 110ms` | per-section content stagger "110ms/child" |
| `--dur-leaf: 8s` | pick inside "7–9s" (midpoint); leaves float ±10–12px (reference: 7s / 8s / 9s per leaf) |
| `--dur-sun: 9s` | sun rotates ±22°, "9s" |
| `--dur-cue: 2s` | scroll cue bounce "2s" |
| `--dur-countup: 1000ms` | count-up "1s cubic ease-out" |
| `--reveal-threshold: 0.16` | **JS constant** (`REVEAL_THRESHOLD` in `src/design/tokens.ts`), not CSS — "~16% threshold" |

**Requested by 05** (`05-animation-system.md` §5.13) — adopted here; 03 owns the names and values. Each value is
verified against the reference entrance logic (desktop L604–613, L645, L765; mobile L495–504 is identical). Where
05's name duplicated a supplementary token from 03's first draft, 05's name wins: `--reveal-rise` replaces
`--rise-distance`, `--reveal-rise-sm` replaces `--rise-distance-sm`; `--stagger-word` was already identical.
`--swap-rise: 6px` (README L73; desktop L760) stays as 03's extra token. All are plain `:root` custom properties
except the two `--ease-*`, which join `@theme` (utilities `ease-std`, `ease-out-cubic`).

| Token: value | Evidence |
|---|---|
| `--dur-sprout: 900ms` | `gpsprout .9s` SPRING — desktop L608 |
| `--dur-roll: 850ms` | `gproll .85s` SOFT — desktop L609 |
| `--dur-drop: 700ms` | `gpdrop .7s ease` — desktop L609 |
| `--dur-swing: 1000ms` | `gpswing 1s ease` — desktop L612 |
| `--dur-bubble: 650ms` / `--dur-bubble-fade: 450ms` | `transform .65s` SPRING / `opacity .45s ease` — desktop L611 |
| `--dur-polaroid-fade: 500ms` | `opacity .5s ease` beside the `.8s` SPRING transform — desktop L610 |
| `--dur-leaf-fast: 7s` / `--dur-leaf-slow: 9s` | per-leaf `gpfloat 7s` / `9s` around the fixed `--dur-leaf: 8s` — desktop L111, L113 |
| `--ease-std: cubic-bezier(.25,.1,.25,1)` | the CSS `ease` keyword used for every opacity track and for `gpdrop` / `gpswing` (desktop L604–613); the value is the spec definition of `ease` |
| `--ease-out-cubic: cubic-bezier(.33,1,.68,1)` | count-up easing `1 - (1 - p)^3` — desktop L645; the standard bezier approximation of ease-out-cubic (README L57 "cubic ease-out") |
| `--reveal-rise: 26px` | header rise-in `translateY(26px)` — desktop L606 (README L47) |
| `--reveal-rise-child: 22px` | non-header default `translateY(22px)` — desktop L613 |
| `--reveal-rise-sm: 18px` | 05's pick inside the mobile "16–20px" (mobile/README L28); the mobile reference itself still uses 26/22 (mobile L497, L504) |
| `--stagger-word: 14ms` / `--stagger-word-cap: 300ms` | locale cascade `210 + Math.min(i * 14, 300)` ms — desktop L765 (README L73 "14ms cascade"); the `210ms` base is `--dur-word-swap` + 10ms and is not tokenised |
| `--nav-h: 58px` (`< md`) / `86px` (`≥ md`) | layout token defined in §4 (logo height + 2 × nav vertical padding; mobile L42–43, desktop L97–98); 05 uses it for `scroll-margin-top` |

Flags: none of the requested values is wrong against the reference. The TS mirror is `src/design/tokens.ts`
(D-03.3, INV-03.4) and 05 uses that path.

The keyframe recipes themselves — `gpsprout`, `gproll`, `gpdrop`, `gpswing`, the bubble inflate (scale .3→1,
origin 12%/88% 100%), polaroid fly-in (±150px, ±10°, scale .9) and the quote ink-in — are owned by
`05-animation-system.md`; 03 supplies only their timing tokens and never restates the keyframes.

`src/design/tokens.ts` mirror (seconds for Motion):

```ts
export const ease = { soft: [0.2, 0.8, 0.25, 1], spring: [0.34, 1.56, 0.5, 1],
  std: [0.25, 0.1, 0.25, 1], outCubic: [0.33, 1, 0.68, 1] } as const;
export const dur = { rise: 0.75, ink: 0.95, polaroid: 0.8, polaroidFade: 0.5, visitFade: 1.1,
  subpage: 0.5, wordSwap: 0.2, sprout: 0.9, roll: 0.85, drop: 0.7, swing: 1, bubble: 0.65,
  bubbleFade: 0.45, leaf: 8, leafFast: 7, leafSlow: 9, sun: 9, cue: 2, countup: 1 } as const;
export const stagger = { child: 0.11, word: 0.014, wordCap: 0.3 } as const;
export const rise = { base: 26, sm: 18, child: 22, swap: 6 } as const; // px
export const REVEAL_THRESHOLD = 0.16;
export const breakpoints = { md: 768, lg: 1024 } as const;
```

### 8 · Responsive strategy

- Design widths: desktop ~1280px (`docs/design/desktop/README.md` L3), mobile 390px (`mobile/README.md` L3).
- Breakpoints: `--breakpoint-md: 48rem` (768px) flips every per-view token in §3–§4 (type scale, section
  padding, nav logo height, button/chip sizes, component sizes); `--breakpoint-lg: 64rem` (1024px) is where 04
  enables the desktop multi-column layouts (3-stone row, 3 bubbles, teacher triptych, visit 2-col, 980px
  polaroid field); `--breakpoint-xl: 80rem` (1280px) only caps `--container-page`.
- Below `md`, the mobile spec applies verbatim including the alternating programs path, stacked bubbles, the
  hamburger (menu visuals not designed — 04 builds a sheet with the same tokens), and the 420px gallery field.
- Tablets (768–1023px) get desktop type and padding in single-column structure; no separate spec exists.
- Tailwind's default `sm`/`2xl` are not overridden; components must not use them (INV-03.3).
- The breakpoint values (`48rem`, `64rem`, `80rem`) are our choice; the design defines only 1280 and 390.

Source shorthand: `D:n` = `docs/design/desktop/README.md` line n, `M:n` = `docs/design/mobile/README.md` line n.

| What changes | `< md` (mobile spec, 390) | `≥ md` (768) | `≥ lg` (1024) | Source |
|---|---|---|---|---|
| section padding | `48px / 24px` (gallery `10px`) | `70px / 44px` | — | D:6, M:6 |
| nav | logo `38px`, pill `13px`, hamburger (locale options listed inline) | logo `50px`, link row `15px`, pill `16px` `12×24`, locale-menu trigger at `--text-lang-toggle` | — | D:7, M:7 |
| hero | headline `36px/1.08`, subhead `15px`, full-width CTA, photo `230px` tall r22, sun `72px` | headline `64px/1.04`, subhead `19px/1.6`, CTA `15×32`, photo `1040×380` r26, sun `118px` | — | D:10, M:11 |
| philosophy | quote `26px/1.35`, photo `190px` r18, badges stacked | quote `44px/1.32`, photo `560×260` r22 | — | D:11, M:12 |
| programs | alternating path, circles `104/122/104`, titles `20–22px` | titles `23–28px`, circles `150/188/150` | three-column row (`200/236/200`, gap `44px`) | D:12, M:13 |
| menu | plate `190px`, chips `13px` | plate `230px`, chips `14px`, sample `15px` | — | D:13, M:14 |
| gallery | 5 polaroids, `420px` field, frame `8+24` | frame `10+30`, polaroid `185–210px` | 7 polaroids, `980×410` field | D:14, M:15 |
| testimonials | 2 stacked bubbles, `14px/1.6` | `16px/1.6` | 3-col grid, gap `24px`, middle `+30px` | D:15, M:16 |
| teachers | Ms. Ping `150px` on top, assistants side-by-side, names `22/17px` | names `26/21px`, photo `196px` | centre + flanks, gaps `40px` | D:16, M:17 |
| visit / footer | stacked, inputs `46px`, photo `120px`, copyright `10px` | inputs `44px`, footer links `14px`, copyright `12px` | `1.2fr/1fr` grid, gap `30px`, photo `150px` | D:17, M:18 |

### 9 · Assets: logo, emoji, photo placeholders

- Logo: `public/brand/logo.png` (D-03.9); rendered heights `50px`/`38px` nav, `42px`/`34px` footer card
  (desktop L98, L338; mobile L43, L246) → intrinsic aspect 373:161 gives ≈116/88/97/79px widths; the 373px
  source covers 2× DPR up to 186px wide. Footer logo card: white, `--radius-logo-card`, `10px 14px` padding.
  OQ-03.6 asks the client for a vector master.
- Emoji: D-03.8; containers are fixed boxes (`56px`/`48px` icon dots, `38px`/`30px` meals dot, `48px` tiles) so
  glyph-width differences between Apple/Noto/Segoe never shift layout.
- Photo placeholders: all photos are client-supplied drop slots (README "Fidelity"). Until real photography
  lands, `PhotoSlot` (04) renders a solid fill of `color-mix(in oklab, <section bg> 92%, var(--color-ink))`
  (our choice — the prototype's `image-slot` styling is not a design value) with the slot label; real images
  go through `next/image` with `sizes` per breakpoint and `placeholder="blur"`. Image radii come from §5 photo
  radii; never from a raw px.

### 10 · Accessibility — contrast audit

WCAG 2.2 AA: text < 24px (or < 18.66px bold) needs **4.5:1**; large text and non-text UI **3:1**. Ratios are
computed from the hex values above (relative-luminance formula; ±0.01). Failures feed OQ-03.2.

| Pair (fg on bg) | Ratio | Verdict | Proposed fix (ratio) |
|---|---|---|---|
| body `#6b7060` on cream `#fbf8f0` | 4.81 | AA | — |
| body `#6b7060` on tinted sections (`#e8efe0` 4.34 · `#f7ecdd` 4.38 · `#eaf0f1` 4.43 · `#f6ece4` 4.39 · `#f0edf4` 4.41) | 4.34–4.43 | **fail** (just under) | `--color-body: #5f6454` (5.19–5.76 everywhere) |
| ink `#34402c` on cream / on teachers bg | 10.33 / 9.46 | AAA | — |
| muted `#8a8170` on cream (lang toggle 14px) | 3.63 | **fail** | `#7a7160` (4.54) |
| muted-2 `#a89e8a` on cream (placeholder, scroll cue) | 2.50 | **fail** | `#7a7160` (4.54) |
| chip text `#4f6b43` on chip bg `#eef2e8` | 5.26 | AA | — |
| white on forest `#3f5538` / panel `#35492f` | 8.18 / 9.79 | AAA | — |
| white on sage `#6f8a5f` (buttons 16–18px Fredoka 500, HEAD TEACHER 11px) | 3.83 | **fail** | fill `#5e7a4e` (4.81, already in palette) or `#4f6b43` (5.97) |
| white on selected chip `#e0a93a` | 2.12 | **fail** | ink text on amber (5.17) |
| white on Yelp `#d3402e` | 4.62 | AA | — |
| amber stars `#f0a93a` on cream / white | 1.90 / 2.01 | decorative | stars `aria-hidden`; rating conveyed by the "5.0" text (ink) |
| amber text `#f0a93a` on menu bg `#fbf2db` (README L31 "amber text") | 1.80 | **fail** | never use `--color-amber` for text on any section bg; text use needs `#b97a12`-class darkening (3.38 on cream — still short of 4.5; treat amber as decorative only) |
| Yelp red `#d3402e` as text on blush `#f6ece4` | 3.97 | **fail** (if used as text) | the design uses red only as badge/button fill with white text (4.62 — pass); keep it that way |
| sun `#f4c64e` on cream; quote mark `#c2d4b6` on `#e8efe0` | 1.52 / 1.33 | decorative | `aria-hidden` |
| nav links `#4a5040` on cream; hover `#3f5538` | 7.87 / 7.71 | AAA | — |
| footer links `#c8d6bd` on forest | 5.38 | AA | — |
| copyright `#8ba07c` on forest (12px) | 2.89 | **fail** | reuse `#c8d6bd` (5.38) |
| panel labels `#9bb78c` on panel (12px) | 4.45 | **fail** (borderline) | `#b5cba8` (5.63) |
| sage accent word `#6f8a5f` on cream (64px) | 3.61 | AA-large | — |
| eyebrows 13px: philosophy `#6f8a5f` 3.26 · programs `#c08552` 2.68 · menu `#bd9326` 2.56 · gallery `#6f8a9a` 3.16 · teachers `#8677a3` 3.50 | 2.56–3.50 | **fail** | use the section link colour for philosophy/gallery/teachers (`#4f6b43` 5.08 · `#56707e` 4.54 · `#6d5f92` 4.90); programs `#8f5a2d` (4.91); menu `#8a6a14` (4.53) |
| links 15px bold: hero/philosophy `#4f6b43` 5.63/5.08 · gallery `#56707e` 4.54 · teachers `#6d5f92` 4.90 | ≥ 4.5 | AA | — |
| links 15px bold: programs `#b06a35` 3.63 · menu `#a8852f` 3.11 · reviews `#c2553f` 3.87 | 3.11–3.87 | **fail** | `#8e5226` (5.32) · `#7d6218` (5.18) · `#a8432f` (5.14) |
| subheads 17px: programs `#7d7468` 3.94 · menu `#897a4e` 3.80 · teachers `#757080` 4.13 · gallery `#6f7a80` 3.82 | 3.80–4.13 | **fail** | `#66604f` (5.37) · `#6f6340` (5.33) · `#5f5a6a` (5.74) · `#58636a` (5.35) |
| review attribution `#9a8578` on white (12px); count `#8a7468` on `#f6ece4` | 3.50 / 3.77 | **fail** | `#7a665a` (5.42) / `#6e5a4f` (5.57) |
| quote `#5c5045` on white | 7.81 | AAA | — |
| day chip `#a89a72` on white (14px) | 2.79 | **fail** | `#7d7048` (4.90) |
| benefit chip `#897a4e` on white (12px); Yelp pill `#a8852f` on `#fff5db` (11px) | 4.24 / 3.19 | **fail** | `#6f6340` (5.94) / `#7f6318` (5.23) |
| input border `#e2dccf` on cream / white (non-text 3:1) | 1.29 / 1.37 | **fail** | `#948c78` (3.34 / 3.15) or accept: filled cream field + label + 2px sage focus border identify the control |
| focus ring forest on cream / white; sun on forest | 7.71 / 8.18 / 5.08 | pass | — |

Reduced motion is owned by 05 (`docs/technical/05-animation-system.md`); this document only guarantees that
every duration is a token so 05 can zero them in one place.

### 11 · Invariants

- **INV-03.1** No raw colour (`#hex`, `rgb()`, `hsl()`, `oklch()`) in component files, CSS Modules or inline
  styles — only `var(--color-*)` / Tailwind colour utilities. Lint: Stylelint `color-no-hex` +
  `declaration-property-value-disallowed-list` on `.module.css`; ESLint `no-restricted-syntax` for hex/rgb
  string literals in `style={}` and `className` (arbitrary values `bg-[#…]` are banned by regex). 08 wires it.
- **INV-03.2** No raw `px` for size, spacing, radius, shadow, duration or easing in components except `0`,
  `1px`/`1.5px` hairlines and SVG geometry — use tokens (`text-headline`, `p-(--section-px)`, `rounded-card`,
  `duration-(--dur-rise)`). Lint: Tailwind arbitrary-value regex (`\[[0-9.]+px\]`) and Stylelint
  `declaration-property-value-disallowed-list` for `transition|animation|box-shadow|border-radius`.
- **INV-03.3** No breakpoint variants other than `md:` and `lg:` (and `xl:` for container caps) in components.
- **INV-03.4** Motion values exist in exactly two places — `src/styles/tokens.css` and `src/design/tokens.ts` —
  and the parity test fails the build if they diverge; the one exception is `REVEAL_THRESHOLD`
  (`--reveal-threshold: 0.16`), which has no CSS twin and lives only in `tokens.ts`.
- **INV-03.5** Token values equal the design handoff unless an OQ-03.2 decision records a replacement in this
  document first; a token change is a doc change plus a code change in one PR.
- **INV-03.6** Typography never branches on locale in TypeScript. The only per-locale styling in the codebase
  is the three `:lang()` rules in `src/styles/tokens.css` — `:root:lang(zh)` for the shared Chinese rules and
  `:root:lang(zh-Hans)` / `:root:lang(zh-Hant)` for `--font-cjk` (D-03.14). No component, hook or
  `src/design/tokens.ts` export reads the locale to pick a family, and `--font-cjk-sc` / `--font-cjk-tc` are
  never referenced outside those two rules (no `font-cjk-sc` utility in any component). The locale-comparison
  half is already machine-checked by 02 INV-02.9's ESLint rule; 08 adds the utility-name check to the
  Tailwind arbitrary-value regex sweep of INV-03.2.

## Open questions

- **OQ-03.1** (design owner) Is the intermediate 768–1023px rendering (desktop type, mobile structure) acceptable,
  or does the owner want a tablet spec? Decide before 04 lands section layouts.
- **OQ-03.2** (design owner, with 04) Which of the §10 proposed AA replacements are approved? Grouped: (a) body
  `#5f6454`, muted/muted-2 `#7a7160`; (b) eyebrow/link/subhead darkening per section; (c) primary-button fill
  `#5e7a4e` vs keeping sage; (d) selected day chip ink text; (e) footer copyright `#c8d6bd`; (f) input border.
  Default if unanswered by the 04 component PR: ship design values, keep this table as the known-failure list.
- **OQ-03.3** (orchestrator / 02) — **answered 2026-08-22 (human, HD-10; 02 D-02.1):** no, not Simplified only.
  Three locales ship — `en`, `zh-Hans` and `zh-Hant` — so one SC-first stack is not enough. `--font-cjk` now
  resolves per script (D-03.14): `--font-cjk-sc` under `:root:lang(zh-Hans)`, `--font-cjk-tc` (`PingFang TC`,
  `Hiragino Sans CNS`, `Microsoft JhengHei`, `Noto Sans CJK TC`, `Noto Sans TC`, `Source Han Sans TC`) under
  `:root:lang(zh-Hant)`, both listed in §3.1. The shared `:root:lang(zh)` typography rules (§3.3) match both
  scripts and are not split. 08's visual-regression matrix gains a `zh-Hant` row (08 owns it).
- **OQ-03.4** (the human — Hanyi; surfaced per memo ADJ-6, restated per HD-11) — **answered 2026-08-22 (human,
  HD-14): the system CJK stack ships for both Chinese scripts, and no CJK webfont is loaded at launch.** The
  question had already changed shape once — HD-11 recorded that the designs name no CJK face (§3.1, D-03.5),
  so the stack was never a substitute for a design value, it is what the prototypes render — and HD-14 then
  confirmed it as the shipping decision. `--font-cjk-sc`, `--font-cjk-tc` and the `--font-cjk` selector stand
  exactly as §3.1 and D-03.14 declare them; nothing in this document is provisional on a later answer, and no
  seat is waiting. Its aliases close with it: **OQ-01.2** (`docs/technical/01-stack-decisions.md`) and
  **OQ-04.9** (`docs/technical/04-components-sections.md`) are the same question carried into those documents,
  and `docs/technical/12-open-questions.md` keeps the three as one register row (each doc marks its own copy —
  03 does not edit them). Naming a Chinese face later stays possible without staying an open question: it is a
  one-token change — point `--font-cjk-sc` and `--font-cjk-tc` at the new families and add the
  `next/font/google` loader with `preload: false, adjustFontFallback: false` scoped to the Chinese layouts, no
  component, no other token, no test moving — weighed against a multi-megabyte CJK build artefact per script
  and a first-paint swap on Chinese pages. The per-OS look at the shipped stack is not lost with the question:
  it is 08's named manual check `MC-08.1 per-OS glyph render` (macOS and Windows 11, `/en` + `/zh-Hans` +
  `/zh-Hant` at 390 and 1280), which already confirms that `zh-Hant` resolves to a Traditional face.
- **OQ-03.5** (design owner) Keep emoji icons or move to an icon set (design README leaves it open)? If swapped,
  the icons need a `--color-*` fill token per section; sizes stay as the fixed containers above.
- **OQ-03.6** (client) Provide a vector (SVG/PDF) logo master; the 373×161 PNG limits crisp rendering above
  ~186px and cannot be recoloured.
- **OQ-03.7** (05) — **answered 2026-08-22:** 05 confirmed `--dur-subpage: 500ms` (the reference's `.55s` desktop
  value is not adopted) and chose per-instance durations `--dur-leaf-fast: 7s` / `--dur-leaf: 8s` /
  `--dur-leaf-slow: 9s` rather than one duration with `animation-delay`; the tokens are in §7.

## Cross-references

- Design: `docs/design/README.md` (tokens L30–43, motion L45–58, assets), `docs/design/desktop/README.md`,
  `docs/design/mobile/README.md`, `docs/design/desktop/Green Pastures - Homepage.dc.html`,
  `docs/design/mobile/Green Pastures - Homepage Mobile.dc.html`, `docs/design/assets/logo.png`, and
  `docs/design/Wireframes.dc.html` (low-fi, cited only in §3.1's font survey — no token comes from it).
- Plan: `docs/technical/01-stack-decisions.md` (ADR-001 + ADJ-1..7: Next.js 16.x, React 19.2, Node 24,
  Tailwind v4, next-intl, Motion; ADJ-4 locale toggle, ADJ-5 no duration namespace, ADJ-6 no CJK subsetting),
  `docs/technical/02-i18n-content-contract.md` (strings; the three locale ids and `LOCALE_META`, D-02.1;
  `<html lang>` per locale, D-02.9; the CJK requirements placed on this doc, D-02.15; no locale branching,
  INV-02.9),
  `docs/technical/04-components-sections.md` (token consumers, `Emoji`, `PhotoSlot`, the locale-switcher menu),
  `docs/technical/05-animation-system.md` (uses §7 names verbatim; reduced motion),
  `docs/technical/06-routing-pages-seo.md` (locale layout sets `lang` and font classes for all three locales),
  `docs/technical/08-testing-quality.md` (lint rules for INV-03.1–3 and INV-03.6, parity test, the
  switch-CLS check, and the per-locale visual snapshot that now needs a `zh-Hant` row),
  `docs/technical/12-open-questions.md` (OQ-03.*; OQ-03.3 and OQ-03.4 are both answered — the latter by HD-14,
  with its aliases OQ-01.2 and OQ-04.9).
- Code paths this doc names: `src/styles/tokens.css`, `src/app/globals.css`, `src/design/tokens.ts`,
  `src/design/fonts.ts`, `public/brand/logo.png`.
