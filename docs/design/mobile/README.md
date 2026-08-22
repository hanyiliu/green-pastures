# Mobile view — specifics

Design width 390px (shown in a phone frame; the frame/status bar/home indicator are presentation only — do not build). Reference: `Green Pastures - Homepage Mobile.dc.html`. Shared tokens, section inventory, and animation-readiness notes are in the root README.

## Layout
- Sections: 48px vertical / 24px horizontal padding (gallery bleeds to 10px); single column, centered text.
- Sticky nav: logo (h 38px) + sage "Book a tour" pill (Fredoka 500 13px) + hamburger. Nav links live in the hamburger menu (not designed yet — build a simple full-screen or sheet menu with the same link set incl. Our Team + language toggle). Footer carries the full link set.
- Touch targets ≥44px (form inputs are 46px; CTAs full-width 15px vertical padding).

## Per-section mobile specs
1. **Hero** — headline Fredoka 36px/1.08; subhead 15px; **full-width** CTA pill; trust row compressed ("6 mo – 4½ yrs"). Photo 230px tall radius 22 with floating meals card. Sun 72px, smaller leaves.
2. **Philosophy** — quote 26px/1.35; photo full-width 190px radius 18; badges stack vertically.
3. **Programs** — stepping stones become an **alternating left/right path**: circle+text rows (Infant 104px left, Toddler 122px right w/ right-aligned text, Preschool 104px left). Titles 20–22px.
4. **Menu** — plate 190px (dots 36/46/36); day chips 13px (9×13 padding, selected 9×16); sample line 13px; benefit chips wrap.
5. **Gallery** — 5 polaroids scattered in a ~420px-tall field (2 top, 2 middle, 1 centered bottom), rotations ±2–6°, frames 8px + 24px bottom; photos ~146–160px wide.
6. **Testimonials** — 2 stacked speech bubbles (tails alternate: `20 20 20 5` then `20 20 5 20`); quote 14px/1.6.
7. **Teachers** — Ms. Ping featured: 150px photo circle + HEAD TEACHER badge, centered on top; two assistants side-by-side below as text cards with 48px icon dots (🧸 / 🎨) — no assistant photos. Names Fredoka 22/17px.
8. **Visit** — form fields full-width stacked (age/start share a 2-col row); full-width submit; photo 120px; info panel stacked; footer centered column (logo card, wrap links incl. Our Team, 10px copyright).

## Added behaviors (in this reference)
- Scroll-snap (proximity) + smooth-scroll CTAs, same as desktop.
- Six slide-in detail subpages (`[data-subpage]`/`[data-back]`), compact single-column layouts; Menu detail uses per-day cards instead of the table.
- Per-section content entrances — identical keyframes/easings/values to desktop (gallery polaroids fly in from alternating sides).
- Language toggle not yet in this view (lives in hamburger menu in production).

## Mobile-only behaviors
- Hamburger opens nav menu (Philosophy, Programs, Menu, Gallery, Reviews, Our Team, Contact, EN·中文).
- Consider slightly shorter reveal distances (translateY 16–20px) so animations feel snappy on small screens; same easing tokens.
- Ambient loops (sun/leaves) are kept but smaller and fewer; keep them cheap (transform-only).
