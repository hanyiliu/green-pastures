# Desktop view — specifics

Design width ~1280px (canvas frame). Reference: `Green Pastures - Homepage.dc.html` (right panel; left panel is the brand/type kit). Shared tokens, section inventory, and animation-readiness notes are in the root README.

## Layout
- Sections: 70px vertical / 44px horizontal padding; content max-width 980–1080px centered.
- Sticky nav: translucent cream `rgba(251,248,240,.92)` + 6px blur, subtle shadow. Logo (h 50px) · links Philosophy / Programs / Menu / Gallery / Reviews / **Our Team** (Nunito 700 15px) · divider · "EN · 中文" · sage pill "Book a tour" (Fredoka 500 16px, 12×24 padding).

## Per-section desktop specs
1. **Hero** — centered column max 760px. Headline Fredoka 600 64px/1.04. Subhead 19px/1.6 max 540px. CTA pill 15×32 + text link. Trust row 14px. Photo below: max 1040px × 380px, radius 26; floating meals card bottom-left (radius 16). Sun 118px top-right; 3 leaves (40/28/22px) scattered.
2. **Philosophy** — quote mark Fredoka 84px `#c2d4b6`; quote 44px/1.32 max 820px; photo 560×260 radius 22.
3. **Programs** — circles in white rings: Infant 150px, Toddler 188px (raised 34px, stronger shadow), Preschool 150px; columns 200/236/200px wide, 44px gap, bottom-aligned. Titles Fredoka 23–28px; age eyebrows 12px.
4. **Menu** — plate 230px (inner inset ring 10px `#fdf3da`); dots 46/56/46px. Day chips Fredoka 14px, 8×16 padding (selected 8×20). Sample line 15px max 580px.
5. **Gallery** — 980×410 field; 7 polaroids ~185–210px wide, 10px frame padding + 30px bottom, rotations −6°…+6°; positions per reference file.
6. **Testimonials** — 3-column grid, 24px gap; middle card pushed down 30px and tail mirrored (`22 22 6 22`; others `22 22 22 6`). Quote 16px/1.6.
7. **Teachers** — order: Ms. Reyes (left) · Ms. Ping (center) · Ms. Chen (right). Ms. Ping: 196px photo circle in a 300px column with HEAD TEACHER badge. Assistants: 230px text columns offset down 44px, 56px white icon dots (🧸 / 🎨) instead of photos. 40px gaps. Names Fredoka 26/21px; blurbs 15/14px.
8. **Visit** — two-column grid 1.2fr/1fr, 30px gap, max 1000px. Form card radius 20, inputs 44px/radius 11. Info column: photo 150px + dark panel `#35492f` radius 18. Footer row: white logo card, links 14px `#c8d6bd` (incl. Our Team), copyright 12px `#8ba07c`.

## Added behaviors (in this reference)
- Scroll-snap (proximity) between sections; smooth-scroll nav/CTAs (`[data-scrollto]`).
- Six slide-in detail subpages (`[data-subpage]`/`[data-back]`) overlaying the page from the right.
- EN ↔ 中文 word-transition toggle (`[data-langtoggle]` + `[data-i18n]` table in the logic).
- Per-section content entrances (see root README motion system).

## Desktop-only behaviors
- Hover states: nav links darken to `#3f5538`; primary buttons lift (shadow deepens, translateY(-1px)); polaroids may straighten slightly on hover (rotate → 0, scale 1.03) — tasteful, optional.
- The full nav link row is visible (no hamburger).
