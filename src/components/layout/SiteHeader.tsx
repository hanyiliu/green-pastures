import { useTranslations } from "next-intl";

import { getSite, type SiteConfig } from "@/content/site";
import { reference } from "@/i18n/messages";

import { BookTourButton } from "./BookTourButton";
import { LangSwitcher } from "./LangSwitcher";
import { LogoCard } from "./LogoCard";
import { MobileMenu } from "./MobileMenu";
import { PrimaryNav, type NavLinkItem } from "./PrimaryNav";

/**
 * The sticky nav (04 §3.1, `D-04.9`).
 *
 * A server component: it reads `site.nav`, resolves every label from
 * `common.nav.<id>` and hands the result down as plain data, so no message and
 * no part of `content/` ever crosses into a client bundle (04 `D-04.2`). The
 * three client leaves below it are the link list, the switcher and the sheet,
 * and each is client for a stated reason.
 *
 * **The row switches at `lg`, not `md`** (`D-04.9`): logo + six links +
 * divider + switcher + pill needs ≈ 955 px, so the hamburger stays until
 * 1024 px while 03's `md` token values (logo height, pill size) still flip at
 * 768 px. That is why the desktop pieces below carry `lg:` and the pill does
 * not — the pill is on both views.
 *
 * **The row's height is `--nav-h` itself, not the sum of its parts.** 03 §4
 * derives the token as logo height + 2 × padding (58 px, 86 px from `md`) and
 * adds the clause "04 keeps nav content within the logo height or updates this
 * token". Below `md` it cannot: INV-04.7 gives the pill and the hamburger a
 * 44 px hit area and the logo is 38 px. Fixing the row to `h-(--nav-h)` and
 * centring its children keeps the promise the other way round — the rendered
 * height *is* the token, on every view, whatever sits inside it — which is what
 * makes `scroll-margin-top: var(--nav-h)` land every anchor correctly.
 */

/**
 * 03 §2.4 puts the translucent cream in `--color-nav-bg` and leaves the blur
 * beside it to 04 as "a component style". There is no blur token to bind and
 * Tailwind's own blur scale has no 6 px step, so the design's value is written
 * here, once, as an inline style rather than as an arbitrary utility (which
 * INV-03.2's regex would reject on sight).
 *
 * **It rides its own layer, and that is not decoration.** `backdrop-filter`
 * makes an element the containing block for every `fixed` descendant. With the
 * filter on `<header>`, the hamburger sheet — a `fixed inset-x-0 top-(--nav-h)
 * bottom-0` panel rendered inside the header — resolved `bottom: 0` against the
 * 58 px nav bar instead of the viewport and came out 64 px tall, scrolling its
 * eleven rows inside a strip the height of the nav. Measured in a browser at
 * 375 px: 64 px with the filter, 754 px without it. Putting the tint and the
 * blur on an `absolute` sibling of the row keeps the design's surface and takes
 * the header back out of the sheet's positioning chain.
 */
const NAV_BLUR = { backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" } as const;

type NavConfigItem = SiteConfig["nav"]["primary"][number];

/** The `common` translator, and the `common.nav.*` half of its key union. */
type CommonTranslator = ReturnType<typeof useTranslations<"common">>;
type NavLabelKey = Extract<Parameters<CommonTranslator>[0], `nav.${string}`>;

/**
 * `common.nav.<id>` for an id that only exists at runtime (04 §4).
 *
 * The membership check is what makes the assertion safe rather than hopeful:
 * `reference` is the `en` tree, whose *shape is* `Messages`, so an id it holds
 * is a real key — and one it does not hold fails the build here instead of
 * rendering a `⟦common.nav.…⟧` marker to a parent. `NavLabelKey` narrows the
 * union to the argument-less `nav.*` keys, which is why the call needs no
 * values object.
 *
 * Exported alongside {@link resolveNavItems} and for the same reason: the
 * footer resolves the same list with the same rule.
 */
export function navLabel(t: CommonTranslator, id: string): string {
  if (!Object.hasOwn(reference.common.nav, id)) {
    throw new Error(
      `content/site.json names the nav id "${id}", but content/en/messages/common.json ` +
        `has no nav.${id} label (02 D-02.4 rule 2).`,
    );
  }
  return t(`nav.${id}` as NavLabelKey);
}

/**
 * Resolve one `site.nav.*[]` group into the serialisable items the client link
 * lists take (04 `D-04.2`, 06 `D-06.7`).
 *
 * Exported because `SiteFooter` resolves the same shape from the same data with
 * the same two rules, and 04 §2's file list has no server-side helper module to
 * put it in. The header is where 04 §3.1 first states the rule, so it is where
 * the rule lives; the footer imports it rather than keeping a second copy that
 * could disagree about what `contact` points at.
 *
 * Two rules, no branches beyond them:
 *
 * - the **href** is the entry's own `href` when it has one (`contact` carries
 *   `"/#visit"` verbatim) and `/#<route.homeAnchor>` otherwise — 06 `D-06.6`'s
 *   one spelling for a home anchor, with no slash before the `#`;
 * - the **label** is `common.nav.<id>`, checked against the reference tree so a
 *   nav id the message file has no label for fails the build here instead of
 *   rendering a `⟦common.nav.…⟧` marker in production.
 */
export function resolveNavItems(
  group: readonly NavConfigItem[],
  site: SiteConfig,
  label: (id: string) => string,
): NavLinkItem[] {
  return group.map((item) => {
    const route = site.routes.find((entry) => entry.id === item.routeId);

    if (item.href === undefined && route === undefined) {
      throw new Error(
        `content/site.json nav entry "${item.id}" names the route id "${String(item.routeId)}", ` +
          `which routes[] does not declare (02 D-02.12).`,
      );
    }

    return {
      id: item.id,
      href: item.href ?? `/#${String(route?.homeAnchor)}`,
      label: label(item.id),
    };
  });
}

export function SiteHeader() {
  const t = useTranslations("common");
  const site = getSite();

  const label = (id: string) => navLabel(t, id);
  const primary = resolveNavItems(site.nav.primary, site, label);

  /**
   * The sheet's list is `site.nav.footer[]` — the six primary links plus
   * Contact, which is precisely what `D-04.8` asks the sheet to carry and what
   * 06 §6.4 describes ("the same hash anchors … plus `contact` → `#visit`").
   * 04 §3.1 sketches `MobileMenu` with `links` and `contact` as two props; they
   * are one list here, because splitting them would mean writing the id
   * `"contact"` into TypeScript to find it again — and keeping nav membership
   * in `content/site.json` is the whole point of 02 `D-02.12`.
   */
  const sheet = resolveNavItems(site.nav.footer, site, label);

  return (
    <header className="sticky top-0 z-50 shadow-nav">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-nav-bg" style={NAV_BLUR} />

      <div className="flex h-(--nav-h) items-center justify-between gap-5 px-4.5 md:px-11">
        <LogoCard placement="nav" />

        <div className="flex items-center gap-5">
          <nav aria-label={t("nav.label")} className="hidden lg:block">
            <PrimaryNav items={primary} />
          </nav>

          <span aria-hidden="true" className="hidden h-6 w-px bg-divider lg:block" />

          <div className="hidden lg:block">
            <LangSwitcher variant="nav" />
          </div>

          <BookTourButton placement="nav" />

          <MobileMenu links={sheet}>
            <LangSwitcher variant="sheet" />
            <BookTourButton placement="sheet" />
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
