import { getLocale, getTranslations } from "next-intl/server";

import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Reveal } from "@/components/motion/Reveal";
import { LearnMoreLink } from "@/components/ui/LearnMoreLink";
import { getGallery } from "@/content/collections";
import { getSite } from "@/content/site";

import { GALLERY_HEADER, GALLERY_LINK_ROW, GALLERY_PADDING } from "./layout";
import { PolaroidField } from "./PolaroidField";

/**
 * The gallery (04 §Sections, `GallerySection`; 05 §5.3; `docs/design/desktop/…`
 * D L215–232 and `docs/design/mobile/…` M L145–159).
 *
 * A header, a wall of polaroids and a link to the gallery page. It composes
 * what Phase 4 built — `Section`, `SectionHeader`, `LearnMoreLink`, `Reveal`,
 * `PhotoSlot` — and adds only its own two leaves (`PolaroidField`, `Polaroid`)
 * and its geometry (`layout.ts`, `D-04.6`).
 *
 * ── Why this one is `async` when the hero is not ─────────────────────────
 *
 * The hero's copy is all messages, so `useTranslations` reaches it from a
 * synchronous server component. The wall's `alt` text is a *collection*:
 * `src/content/collections.ts` joins `site.gallery.photos[]` with this locale's
 * `collections.gallery.photos.<id>` through a Zod schema that makes a missing
 * `alt` a build failure rather than an unlabelled image (INV-02.3). That join
 * is asynchronous, so the section awaits it, and an async server component
 * reads its own copy through `getTranslations` rather than the hook.
 *
 * The alternative — addressing `collections.gallery.photos.<id>.alt` as an
 * ordinary message key — would need a cast at every call site, because a photo
 * id is a `string` and next-intl types message keys as literals, and it would
 * step around the schema that is the actual guarantee. The await is cheaper.
 *
 * ── Three reveals, and the wall is a stagger container ───────────────────
 *
 * Header and link are plain `rise`; the wall is a stagger group whose children
 * play `polaroid`, 110ms apart, alternating sides by index parity (05 §5.3's
 * gallery row). The container is never itself transformed (INV-05.4). Three
 * `Reveal`s and no `RevealItem` observes anything, so the section adds no
 * second IntersectionObserver (INV-05.9).
 *
 * ── The title names the daycare, and the name is configuration ───────────
 *
 * `home.gallery.title` is "Life at {brandShortName}" (`D-04.17`), so the
 * localized short name comes from `site.brand.shortName[locale]` and is spread
 * into `t()`. `D-04.17` puts that lookup in a `brandArgs(locale)` helper in
 * `src/content/site.ts`; that file belongs to another row and the helper does
 * not exist yet, so — exactly as `Copyright` and `LogoCard` already do — the
 * one field this section needs is read here. When the helper lands, all three
 * call sites collapse into it.
 *
 * ── The intro is drawn on the wide view only ─────────────────────────────
 *
 * M L147 draws an eyebrow and a title and no intro; D L217–219 draws all three.
 * That is `introDesktopOnly`, which renders the string once and lets `md:`
 * decide — never a view branch in code (`D-04.5`, INV-04.4).
 */

/** The `h2`'s id, which the `Section` points `aria-labelledby` at (INV-04.8). */
const GALLERY_TITLE_ID = "gallery-title";

/** The `site.routes[]` id the closing link resolves through (02 `D-02.12`). */
const GALLERY_ROUTE_ID = "gallery";

export default async function GallerySection() {
  const locale = await getLocale();
  const t = await getTranslations("home.gallery");
  const { photos } = await getGallery(locale);

  const brandShortName = getSite().brand.shortName[locale];
  const onHome = photos.filter((photo) => photo.onHome);

  return (
    <Section id="gallery" labelledBy={GALLERY_TITLE_ID} className={GALLERY_PADDING}>
      <Reveal id="gallery.header" variant="rise">
        <SectionHeader
          titleId={GALLERY_TITLE_ID}
          eyebrow={t("eyebrow")}
          title={t("title", { brandShortName })}
          intro={t("intro")}
          introDesktopOnly
          className={GALLERY_HEADER}
        />
      </Reveal>

      <PolaroidField photos={onHome} />

      <Reveal id="gallery.link" variant="rise" className={GALLERY_LINK_ROW}>
        <LearnMoreLink routeId={GALLERY_ROUTE_ID}>{t("link")}</LearnMoreLink>
      </Reveal>
    </Section>
  );
}
