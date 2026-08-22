# Handoff: Green Pastures Montessori Daycare — Homepage (Desktop + Mobile)

## Overview
Marketing website homepage for **Green Pastures Montessori Daycare** (Fremont, CA — bilingual English/中文, ages 6 months–4½ years). The homepage is a single continuous vertical scroll of **8 self-contained "worlds"** — each section has its own background color/mood, summarizes one subpage, and links into it with a "learn more →". Primary goals: get parents to book a tour; build trust via Yelp reviews/testimonials.

This bundle contains two views of the same design:
- `desktop/` — hi-fi desktop homepage (~1280px design width) + specifics
- `mobile/` — hi-fi mobile homepage (390px design width) + specifics

Read this root README first (shared system), then the README in each subdir.

## About the Design Files
The `.dc.html` files are **design references created in HTML** — prototypes showing intended look and behavior, **not production code to copy directly**. Recreate them in the target codebase's environment using its established patterns; if no codebase exists yet, choose an appropriate modern framework (this is a content site — static-friendly SSR like Next.js/Astro fits well). `image-slot.js` / `support.js` are prototype-only helpers; do not port them.

## Fidelity
- **Homepage (both views): high-fidelity.** Recreate pixel-perfectly using the tokens below.
- **Inner subpages** (Philosophy, Programs, Menu, Gallery, Reviews, Staff, FAQ, Enrollment): **low-fidelity wireframes only** — see `desktop/Wireframes.dc.html` row 2 for structure; apply this design system.
- All photos are **placeholder drop slots** — client supplies real photography. Teacher names/credentials, testimonial quotes/names, and Yelp counts (5.0, 47) are placeholder content; wire to real data.

## ⚠ Animation-ready architecture (important)
The client plans to **add many more scroll/interaction animations** beyond what the prototypes show. Build with that in mind:
- Drive all entrance animations through one reusable reveal system (IntersectionObserver-based hook/directive with variants + stagger support, e.g. Motion/Framer Motion or GSAP ScrollTrigger) rather than one-off CSS.
- Keep sections and decorative elements (suns, leaves, polaroids, plate, stepping-stones) as **discrete, individually addressable components** so they can later be parallaxed, pinned, or scroll-scrubbed without refactoring.
- Avoid layout techniques that fight transforms (no overflow clipping on elements that will translate; reserve `will-change` usage; keep transforms off layout-critical wrappers).
- Centralize timing/easing tokens (durations, cubic-beziers below) so new animations stay consistent.
- Respect `prefers-reduced-motion` globally from day one.

## Design Tokens (shared)
Colors:
- Sage (primary): `#6f8a5f` · Forest (dark bg): `#3f5538` (panel `#35492f`)
- Sun accent: `#f4c64e` (amber text `#f0a93a`, selected chip `#e0a93a`) · Peach: `#e8a87c`
- Cream page bg: `#fbf8f0` · Ink headings: `#34402c` · Body `#6b7060` · Muted `#8a8170`/`#a89e8a`
- Section backgrounds in scroll order: Hero `#fbf8f0` · Philosophy `#e8efe0` · Programs `#f7ecdd` · Menu `#fbf2db` · Gallery `#eaf0f1` · Testimonials `#f6ece4` · Teachers `#f0edf4` · Visit `#3f5538`
- Chips: `#eef2e8` bg / `#4f6b43` text · Yelp red `#d3402e` · Teachers accent `#8677a3` (link `#6d5f92`)

Typography:
- **Headings: Fredoka** (Google Fonts) 500–600 · **Body: Nunito** 600–700
- Eyebrows: Nunito 700, letter-spacing 1.5px, uppercase, section accent color
- Links: 2px bottom border in the section's accent tint; text in section accent

Shape & elevation:
- Pills 999px; cards 18–22px; photos 14–26px radius
- Card shadows `0 10–20px 26–44px rgba(warm tint, .07–.18)`; primary button `0 10px 24px rgba(111,138,95,.32)`

Motion system (identical on desktop & mobile; reuse these tokens for future animations):
- Easings: SOFT `cubic-bezier(.2,.8,.25,1)` · SPRING `cubic-bezier(.34,1.56,.5,1)`
- Section headers/blocks: calm rise-in from `translateY(26px)`, .7–.8s SOFT
- **Per-section content entrances** (staggered 110ms/child, reveal once, ~16% threshold; exact keyframes in the reference files):
  · Hero — gentle rise · Philosophy — quote "inks in" from `blur(14px) scale(.97)` (.95s)
  · Programs — stones "sprout" from the ground (`gpsprout`: scaleY .25→1.07→1, origin 50% 100%, SPRING)
  · Menu — plate "rolls in" (`gproll`: translateX(-90px) rotate(-150deg)→0); chips/lines "drop-bounce" (`gpdrop`: translateY(-34px)→+7→−4→0)
  · Gallery — polaroids fly in from alternating sides (translateX ±150px, rotate ±10°, scale .9 → settle, .8s SPRING)
  · Reviews — bubbles inflate from tail corner (scale .3→1 SPRING, transform-origin 12%/88% 100% per tail) — the only pop
  · Teachers — frames "swing & settle" (`gpswing`: rotate −9°→5→−2.5→1→0, origin 50% 0%)
  · Visit — slow 1.1s fade
- Ambient loops: leaves float ±10–12px w/ slight rotate (7–9s), sun rotates ±22° (9s), scroll cue bounces (2s)
- Count-up: 1s cubic ease-out (Yelp 5.0 / 47)

## Section inventory (both views, same order & content)
1. **Hero** (cream) — eyebrow chip, "Where small hands learn **big things**", subhead, Book a tour CTA + philosophy link, trust row (★5.0 Yelp · ages), wide photo with floating meals card, sun + leaves, bounce scroll cue.
2. **Philosophy** (soft green) — big decorative quote + Fredoka pull-quote ("guiding, not pushing"), classroom photo, certified-Montessori pill + "English · 中文 bilingual welcome", link → Philosophy page.
3. **Programs** (warm sand) — three circular photo "stepping stones": Infant (6–18 mo), Toddler (1.5–3 y, emphasized), Preschool (3–4½ y), link → Programs page.
4. **Menu** (soft yellow) — plate graphic (breakfast/lunch/snack dots), Mon–Fri day chips (selected = amber; swaps sample-meals line), vegetarian/allergy chips, link → Menu page. Full weekly table lives on the subpage.
5. **Gallery** (soft blue) — scattered rotated polaroids (white frame, ±2–6°), link → Gallery page.
6. **Testimonials** (blush) — ★★★★★ + count-up 5.0 + Yelp badge + 47 reviews; speech-bubble cards (one squared corner as tail); link → Yelp (new tab).
7. **Teachers** (soft lavender) — "Who we are / The faces your child will love". **Only Ms. Ping has a headshot** (large circle + green HEAD TEACHER badge, "AMS certified · main point of contact, English or 中文"), placed **in the center** on desktop with the two assistants flanking left (Ms. Reyes 🧸) and right (Ms. Chen 陈老师 🎨) as text-only cards with small icon dots — no assistant photos. Mobile: Ms. Ping on top, assistants side-by-side below. Link "Meet the whole team →" → Staff page (same rule there: photo slot for Ms. Ping only). *Names/credentials are placeholders.*
8. **Visit / Enroll + footer** (forest, white text) — inquiry form (Parent name, Email, Child's age select, Desired start, message; sage "Request a tour →"), map/building photo, info panel (Fremont CA · Mon–Fri 7:30am–6:00pm · English · 中文 Mandarin), footer with logo card, nav links (incl. Our Team), bilingual copyright + license #.

## Interactions & state (shared)
- **Scroll-snap**: `scroll-snap-type: y proximity` on the scroll container; each section `scroll-snap-align: start` with scroll-margin for the sticky nav. Smooth scrolling throughout.
- **Animated in-page nav**: nav links, hero CTAs, and the scroll cue smooth-scroll to their sections (prototype: `[data-scrollto]` → scrollTo behavior smooth).
- **Detail subpages**: every section's "learn more →" (`[data-subpage]`) slides a full detail page in from the right (.5s SOFT translateX 103%→0); "← Back" slides it out. Both views have all six: Philosophy (principles + daily timeline), Programs (per-room cards w/ ratios), Menu (full weekly menu — table on desktop, day cards on mobile), Gallery (filter chips + grid), Reviews (quotes + Yelp button), Team (Ms. Ping bio + assistants). In production these become real routes with the same slide transition.
- **EN ↔ 中文 toggle** (desktop reference): clicking "EN · 中文" crossfades each tagged string (`[data-i18n]`, ~200ms fade + 6px rise, 14ms cascade). Translation table in the desktop file covers nav/hero/section titles/links/CTAs; extend to all copy in production.
- Sticky nav; CTA → Visit form; all copy i18n-ready.
- Menu `selectedMenuDay` (default = current weekday) swaps sample line.
- Form: required name/email/age, email validation, success + error states; submissions to daycare email/CRM (backend open).
- State: `language`, `selectedMenuDay`, per-element revealed flags, form state; data for menus/testimonials/teachers/Yelp counts should be easily editable (CMS or config).

## Assets
- `assets/logo.png` (in each subdir) — real client logo; place on white/cream.
- Sun/leaf decorations: simple inline SVGs (paths in the reference files) — make them reusable components (they will be animated further).
- Emoji as lightweight icons (🌱🍎🌿🥦🌾) — keep or swap for an icon set.
- Needed photography: hero, classroom, 3 program rooms, 5–7 gallery, 3 teachers, map/building, optional testimonial avatars.

## Files
Root (shared):
- `README.md` — this file: shared system, tokens, sections, motion, interactions
- `assets/logo.png` — client logo
- `Wireframes.dc.html` — exploration history + inner-page wireframe structures
- `image-slot.js`, `support.js` — prototype-only helpers (do not port)

Per view:
- `desktop/Green Pastures - Homepage.dc.html` — desktop reference + brand/type kit panel, with `desktop/README.md` specs
- `mobile/Green Pastures - Homepage Mobile.dc.html` — mobile reference (phone frame), with `mobile/README.md` specs
- (each subdir carries its own copies of assets/helpers so the reference file opens standalone)
