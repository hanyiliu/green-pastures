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

export type SubpageHeaderProps = {
  /** The page's message namespace — `philosophy`, `programs`, `menu`, … */
  readonly page: SubpageNamespace;
  /** Extra classes for the header stack, under `withOverrides`' contract. */
  readonly className?: string;
};

export function SubpageHeader({ page, className }: SubpageHeaderProps) {
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
  // (`intro` + `introShort`, both rendered, `md:` picks one) or a lone intro.
  // The `undefined` check is what keeps the pair well-formed — an `introShort`
  // without an `intro` would render a header whose only intro disappears at
  // `md`, which is the failure that type distinction exists to prevent.
  const header =
    intro !== undefined && introShort !== undefined ? (
      <SectionHeader
        as="h1"
        titleId={titleId}
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        introShort={introShort}
        className={className}
      />
    ) : (
      <SectionHeader
        as="h1"
        titleId={titleId}
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        className={className}
      />
    );

  return (
    <Reveal id={`${page}.header`} variant="rise">
      {header}
    </Reveal>
  );
}
