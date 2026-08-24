import { useMessages, useTranslations } from "next-intl";

import { Reveal } from "@/components/motion/Reveal";
import type { Messages } from "@/i18n/messages";

import { SectionHeader } from "./SectionHeader";

/**
 * The eyebrow → heading → intro stack every detail page opens with
 * (04 §3.1, §1; desktop reference L354–357, mobile L262–266).
 *
 * It is `SectionHeader` with `as="h1"` and nothing else: the design draws the
 * subpage header and a home section header with the same three lines, the same
 * centred alignment and the same gaps, so the recipe is shared rather than
 * copied (04 §3.1 lists `SectionHeader`'s design source as "every
 * section/subpage header"). What this component adds is the part a subpage
 * cannot express as props — reading the four keys out of the page's own
 * namespace, and knowing which of them that namespace actually has.
 *
 * **Not every page has all four.** `philosophy` has `eyebrow`, `intro` and
 * `introShort`; `programs` and `menu` have an `eyebrow` and (menu only) an
 * `intro`; `gallery`, `reviews` and `team` have neither. That is content, not a
 * per-page branch in code — the component asks the message tree what is there
 * (`t.has`) and renders what it finds, so an owner who adds
 * `reviews.eyebrow` to all three locales gets an eyebrow with no code change
 * (INV-04.4).
 *
 * **The `h1` is the focus target after the slide** (05 §5.7). Its id is
 * {@link subpageTitleId}, which is the same `<id>-title` shape the home
 * sections use, and `BackLink` — the shell's one client component — focuses it
 * on arrival. See `BackLink.tsx` for why the focus move lives there and why the
 * `tabIndex` is applied at focus time rather than rendered.
 *
 * ── Three decisions the six pages used to make one at a time ────────────
 *
 * The header is the same block on every detail page, so the answers that were
 * once six copies of themselves live here now: the registry key that keeps the
 * entrance from being eaten by a home section ({@link headerRevealId}), the
 * bottom margin the gapped column does not want ({@link HEADER}), and the
 * shape checks below, which turn a message tree the two intro props cannot
 * describe into a readable failure rather than a header with no intro in it.
 */

/**
 * A message namespace that carries a subpage header, derived from the `en`
 * tree rather than listed: every namespace with a `kicker` is a page namespace
 * (02 §Key naming; `<route>.kicker` is the sticky bar's label).
 *
 * Deriving it is what keeps INV-04.11 / INV-04.4 true here — the six launch
 * routes are `content/site.json`'s business, and `faq` / `visit`, whose
 * namespaces exist for the two reserved pages (`D-02.17`), type-check without
 * being routes. `SubpageBar` is where a namespace that is not a route fails,
 * because that is where `site.routes[]` is consulted.
 */
export type SubpageNamespace = {
  [K in keyof Messages]: Messages[K] extends { readonly kicker: string } ? K : never;
}[keyof Messages];

/**
 * The subpage namespaces that carry a given optional key.
 *
 * next-intl's key type is the set of keys the **`en`** tree actually has, so
 * `t(`${page}.eyebrow`)` over the whole of {@link SubpageNamespace} does not
 * type-check — `gallery.eyebrow` is not a key, because Gallery's header is a
 * heading and nothing else. This narrows the union to the namespaces where the
 * key exists, and {@link pageHas} is the runtime check that gets a call site
 * from one to the other.
 */
type NamespaceWith<K extends string> = Extract<
  SubpageNamespace,
  { [N in SubpageNamespace]: K extends keyof Messages[N] ? N : never }[SubpageNamespace]
>;

/**
 * Does this page's namespace carry `key`? A type predicate, so the `t()` call
 * in the true branch sees a namespace union the key is valid for.
 *
 * The check reads the message tree rather than `t.has`, for the same reason
 * `t()` needed narrowing in the first place: `t.has` takes the same constrained
 * key type and would not accept the wide union either.
 */
function pageHas<K extends string>(
  messages: Messages,
  page: SubpageNamespace,
  key: K,
): page is NamespaceWith<K> {
  return key in messages[page];
}

/**
 * The `h1`'s id on a detail page — the same `<id>-title` shape every home
 * section uses for `aria-labelledby` (`philosophy-title`, `gallery-title`, …).
 * `BackLink` focuses it; a page that needs to point at its own heading reads it
 * from here rather than spelling it.
 */
export function subpageTitleId(page: SubpageNamespace): string {
  return `${page}-title`;
}

/**
 * The header's `Reveal` registry key — **not** `<page>.header`.
 *
 * The registry is once per session and keyed by the id alone (05 `D-05.6`): the
 * first `Reveal` to enter the viewport writes its id, and every later mount of
 * that id renders the final state with no entrance. Three of the six page
 * namespaces are also home section ids, so `gallery.header`, `programs.header`
 * and `menu.header` are already spoken for by `GallerySection`,
 * `ProgramsSection` and `MenuSection`. A reader who scrolled past the home
 * Gallery section and then opened `/gallery` got a header that had "already
 * played" and skipped its rise; Philosophy and Team, whose home anchors are
 * named differently, played theirs. Prefixing the surface is what makes the two
 * blocks two keys.
 *
 * It is derived here rather than taken as a prop for the reason the rest of
 * this file exists: a seventh detail page cannot forget what it never writes.
 */
function headerRevealId(page: SubpageNamespace): string {
  return `subpage.${page}.header`;
}

/**
 * The header stack's own bottom clearance, released to the column's gap.
 *
 * `SectionHeader` closes with `mb-7 md:mb-11` because a home `Section` puts no
 * gap between its children and the header has to make its own. `SubpageBar`'s
 * content column *is* a gapped flex column, so on a detail page that margin
 * lands **on top of** the gap — 16 + 28 on the narrow view, 24 + 44 on the wide
 * one, where the references draw 16 and 24. Every detail page reached the same
 * conclusion and wrote it down separately; the arithmetic is the shell's, so
 * the answer is too.
 *
 * **Both halves, and the pair is deliberate.** `mb-0!` alone leaves `md:mb-11`
 * to be settled by importance, and the two readings of that cascade disagree;
 * making the `md:` twin important as well removes the question — at `≥ md` both
 * rules are important and the `md:` one is later in the stylesheet, so it wins
 * under either reading (`src/components/ui/class-names.tsx`).
 */
const HEADER = "mb-0! md:mb-0!";

export type SubpageHeaderProps = {
  /** The page's message namespace — `philosophy`, `programs`, `menu`, … */
  readonly page: SubpageNamespace;
  /**
   * `true` where the design draws the intro on the wide view only — 04 §4's
   * Menu-page row is the one that asks for it today. `SectionHeader` renders
   * the string once and lets `md:` hide it, so the view is never a branch in
   * code (`D-04.5`), and the page says so rather than the shell guessing from
   * the key's name.
   */
  readonly introDesktopOnly?: boolean;
};

export function SubpageHeader({ page, introDesktopOnly = false }: SubpageHeaderProps) {
  // The root translator, not `useTranslations(page)`: the namespace is a union
  // of eight literals, and a translator narrowed to a union of namespaces is a
  // union of call signatures that no single `t("heading")` satisfies. The root
  // translator has one signature over every key in the tree, and the template
  // literal keeps the keys typed — `t("philosophy.nope")` is still an error.
  const t = useTranslations();
  const messages = useMessages();

  const eyebrow = pageHas(messages, page, "eyebrow") ? t(`${page}.eyebrow`) : undefined;
  const intro = pageHas(messages, page, "intro") ? t(`${page}.intro`) : undefined;
  const introShort = pageHas(messages, page, "introShort") ? t(`${page}.introShort`) : undefined;

  const title = t(`${page}.heading`);
  const titleId = subpageTitleId(page);

  // `SectionHeader`'s two intro shapes are exclusive by construction: a pair
  // (`intro` + `introShort`, both rendered, `md:` picks one) or a lone intro
  // that may be `≥ md` only. There the shapes are a type error apart; here the
  // pair is assembled from whatever the message tree happens to hold, so the
  // two combinations the types reject have to be rejected at runtime instead.
  // Both used to pass silently, and both lose copy: the first rendered a header
  // with no intro at all, the second ignored the page's own prop.
  if (introShort !== undefined && intro === undefined) {
    throw new Error(
      `The "${page}" namespace has an introShort and no intro, which is half of a pair ` +
        `(04 D-04.5): introShort is the < md twin of intro, and on its own it would leave the ` +
        `header with no intro on either view. Add ${page}.intro to every locale, or rename the ` +
        `key to ${page}.intro if the one string is meant for both views.`,
    );
  }

  if (introShort !== undefined && introDesktopOnly) {
    throw new Error(
      `The "${page}" page asked for introDesktopOnly, but its namespace carries an introShort. ` +
        `The two say different things about the narrow view — introShort draws the short copy ` +
        `there, introDesktopOnly draws nothing — and SectionHeader accepts only one of them ` +
        `(04 D-04.5). Drop the prop, or drop ${page}.introShort from every locale.`,
    );
  }

  const header =
    intro !== undefined && introShort !== undefined ? (
      <SectionHeader
        as="h1"
        titleId={titleId}
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        introShort={introShort}
        className={HEADER}
      />
    ) : (
      <SectionHeader
        as="h1"
        titleId={titleId}
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        introDesktopOnly={introDesktopOnly}
        className={HEADER}
      />
    );

  return (
    <Reveal id={headerRevealId(page)} variant="rise">
      {header}
    </Reveal>
  );
}
