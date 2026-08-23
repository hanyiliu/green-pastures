import { loadMessages, reference } from "@/i18n/messages";
import type { Locale } from "@/i18n/routing";

import { faqCollectionSchema, type FaqShared, type FaqText } from "./schemas/faq";
import {
  galleryCollectionSchema,
  type GalleryCategoryShared,
  type GalleryPhotoShared,
  type GalleryPhotoText,
} from "./schemas/gallery";
import {
  menuCollectionSchema,
  type DayId,
  type DietaryShared,
  type DietaryText,
  type MealId,
} from "./schemas/menu";
import { programsCollectionSchema, type ProgramShared, type ProgramText } from "./schemas/programs";
import { parseContent } from "./schemas/primitives";
import { teachersCollectionSchema, type TeacherShared, type TeacherText } from "./schemas/teachers";
import {
  testimonialsCollectionSchema,
  type TestimonialShared,
  type TestimonialText,
} from "./schemas/testimonials";
import { getSite } from "./site";

/**
 * Typed accessors that join `content/site.json`'s shared ids with one locale's
 * text (02 `D-02.11`, `D-02.7`).
 *
 * **Server-only (02 `D-02.16`).** A client subtree receives only the namespaces
 * it needs — `common`, `visit`, `gallery`, plus `errors` on the route error
 * boundary — and never `collections.*` wholesale: the menu's sample lines and
 * day chips, for instance, are pre-rendered on the server and handed to the
 * client `WordSwap` as **props**. `src/i18n/messages.ts`'s `clientMessages()`
 * enforces that for the provider; the guard below enforces it for this module,
 * which would otherwise be an easy back door for the whole collection tree.
 * A unit test that needs this file must run under `// @vitest-environment node`.
 *
 * **Parsed on first use, once per locale.** Each accessor resolves through
 * {@link getCollections}, which memoises the parsed, joined result. An invalid
 * collection file therefore fails `next build` with a readable Zod issue, the
 * same way `src/content/site.ts` does for the shared config.
 *
 * **Fallback.** Collections are *data*, so next-intl's `⟦namespace.key⟧` marker
 * (02 `D-02.8`) has nowhere to appear: there is no `t()` call to intercept, and
 * a missing `alt` would be an unlabelled image rather than a visible gap. This
 * module therefore merges the locale's text over `en` in **every** environment,
 * and logs each gap outside production so an editor still sees it. The real
 * gate is `pnpm validate:content` (INV-02.2, INV-02.3).
 */

if (typeof window !== "undefined") {
  throw new Error(
    "src/content/collections.ts is server-only (02 D-02.16): collections.* must never " +
      "be sent to the browser. Render the values in a Server Component and pass props.",
  );
}

/* -------------------------------------------------------------------------- *
 * Joined entry types — what a component actually receives
 * -------------------------------------------------------------------------- */

/** A shared record from `site.json` with its per-locale text attached. */
type Joined<TShared, TText> = TShared & { readonly text: TText };

export type ProgramEntry = Joined<ProgramShared, ProgramText>;
export type TeacherEntry = Joined<TeacherShared, TeacherText>;
export type TestimonialEntry = Joined<TestimonialShared, TestimonialText>;
export type GalleryPhotoEntry = Joined<GalleryPhotoShared, GalleryPhotoText>;
export type DietaryEntry = Joined<DietaryShared, DietaryText>;
export type FaqEntry = Joined<FaqShared, FaqText>;

/** A filter chip: the shared flags plus the translated category name. */
export type GalleryCategoryEntry = GalleryCategoryShared & { readonly name: string };

export type GalleryEntries = {
  readonly categories: readonly GalleryCategoryEntry[];
  readonly photos: readonly GalleryPhotoEntry[];
};

export type MenuEntries = {
  /** The sample week's columns, in display order (`mon` … `fri`). */
  readonly days: readonly DayId[];
  /** The rows, in serving order. */
  readonly meals: readonly MealId[];
  /** `week[day][meal]` — the dish in one cell. */
  readonly week: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly dietary: readonly DietaryEntry[];
};

export type LocaleCollections = {
  readonly programs: readonly ProgramEntry[];
  readonly teachers: readonly TeacherEntry[];
  readonly gallery: GalleryEntries;
  readonly testimonials: readonly TestimonialEntry[];
  readonly menu: MenuEntries;
  readonly faq: readonly FaqEntry[];
};

/* -------------------------------------------------------------------------- *
 * Loading
 * -------------------------------------------------------------------------- */

type Tree = Record<string, unknown>;

function isTree(value: unknown): value is Tree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merge `override` over `base`, collecting the dotted path of every leaf
 * `base` supplies and `override` does not — the gaps an editor should see.
 */
function mergeWithGaps(base: Tree, override: Tree, prefix: string, gaps: string[]): Tree {
  const merged: Tree = {};
  for (const [key, baseValue] of Object.entries(base)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    const overrideValue = Object.hasOwn(override, key) ? override[key] : undefined;
    if (overrideValue === undefined) {
      gaps.push(path);
      merged[key] = baseValue;
      continue;
    }
    merged[key] =
      isTree(baseValue) && isTree(overrideValue)
        ? mergeWithGaps(baseValue, overrideValue, path, gaps)
        : overrideValue;
  }
  // Keys the locale has and `en` does not are orphans; keep them so the schema
  // reports them as unrecognised rather than silently dropping the editor's work.
  for (const [key, value] of Object.entries(override)) {
    if (!Object.hasOwn(base, key)) merged[key] = value;
  }
  return merged;
}

/**
 * One locale's collection tree, merged over the `en` reference so every id is
 * present, with the gaps reported outside production (see the module note).
 */
async function loadCollectionTree(locale: Locale): Promise<Tree> {
  const messages = await loadMessages(locale);
  const loaded: unknown = messages.collections;
  const localeTree = isTree(loaded) ? loaded : {};
  const referenceTree: unknown = reference.collections;
  if (!isTree(referenceTree)) throw new Error("The en collection tree is missing (02 D-02.7).");

  const gaps: string[] = [];
  const merged = mergeWithGaps(referenceTree, localeTree, "", gaps);

  if (gaps.length > 0 && process.env.NODE_ENV !== "production") {
    console.error(
      `[content] ${String(gaps.length)} collection value(s) are missing from "${locale}" and ` +
        `render the en text instead — ${gaps.join(", ")} (02 D-02.8; pnpm validate:content is the gate).`,
    );
  }
  return merged;
}

/* -------------------------------------------------------------------------- *
 * Joining
 * -------------------------------------------------------------------------- */

function idsOf(entries: ReadonlyArray<{ readonly id: string }>): readonly string[] {
  return entries.map((entry) => entry.id);
}

function join<TShared extends { readonly id: string }, TText>(
  shared: readonly TShared[],
  text: Readonly<Record<string, TText>>,
  source: string,
): Array<Joined<TShared, TText>> {
  return shared.map((entry) => {
    const value = text[entry.id];
    // Unreachable while the schemas hold — the id record is exhaustive — but a
    // thrown path beats a `undefined` that only shows up as a blank card.
    if (value === undefined) {
      throw new Error(`${source} has no text for id "${entry.id}" (02 INV-02.3).`);
    }
    return { ...entry, text: value };
  });
}

/**
 * INV-02.3's image half for the one collection where the photo is optional: a
 * teacher who has a photograph must have an `alt` for it in this locale.
 */
function requirePhotoAlt(teachers: readonly TeacherEntry[], source: string): void {
  for (const teacher of teachers) {
    if (teacher.photo !== undefined && teacher.text.photoAlt === undefined) {
      throw new Error(
        `${source}: teacher "${teacher.id}" has a photo in content/site.json but no photoAlt (INV-02.3).`,
      );
    }
  }
}

function buildCollections(locale: Locale, tree: Tree): LocaleCollections {
  const site = getSite();
  const at = (namespace: string) => `content/${locale}/collections/${namespace}.json`;

  const programs = join(
    site.programs,
    parseContent(programsCollectionSchema(idsOf(site.programs)), tree.programs, at("programs")),
    at("programs"),
  );

  const teachers = join(
    site.teachers,
    parseContent(teachersCollectionSchema(idsOf(site.teachers)), tree.teachers, at("teachers")),
    at("teachers"),
  );
  requirePhotoAlt(teachers, at("teachers"));

  const testimonials = join(
    site.testimonials,
    parseContent(
      testimonialsCollectionSchema(idsOf(site.testimonials)),
      tree.testimonials,
      at("testimonials"),
    ),
    at("testimonials"),
  );

  const faq = join(
    site.faq,
    parseContent(faqCollectionSchema(idsOf(site.faq)), tree.faq, at("faq")),
    at("faq"),
  );

  const galleryText = parseContent(
    galleryCollectionSchema(site.gallery),
    tree.gallery,
    at("gallery"),
  );
  const gallery: GalleryEntries = {
    categories: site.gallery.categories.map((category) => {
      const name = galleryText.categories[category.id];
      // Unreachable while the schema holds; a thrown path beats a filter chip
      // that silently renders its own id.
      if (name === undefined) {
        throw new Error(`${at("gallery")} has no name for category "${category.id}" (INV-02.3).`);
      }
      return { ...category, name };
    }),
    photos: join(site.gallery.photos, galleryText.photos, at("gallery")),
  };

  const menuText = parseContent(menuCollectionSchema(site.menu), tree.menu, at("menu"));
  const menu: MenuEntries = {
    days: site.menu.days,
    meals: site.menu.meals,
    week: menuText.week,
    dietary: join(site.menu.dietary, menuText.dietary, at("menu")),
  };

  return { programs, teachers, gallery, testimonials, menu, faq };
}

/* -------------------------------------------------------------------------- *
 * Accessors
 * -------------------------------------------------------------------------- */

const cache = new Map<Locale, Promise<LocaleCollections>>();

/**
 * Every collection for one locale, joined with `content/site.json` and in the
 * display order `site.json` declares. Parsed once per locale per process.
 */
export function getCollections(locale: Locale): Promise<LocaleCollections> {
  const cached = cache.get(locale);
  if (cached !== undefined) return cached;

  const pending = loadCollectionTree(locale)
    .then((tree) => buildCollections(locale, tree))
    // A failed parse must not be memoised as a permanent failure in `next dev`,
    // where the editor is expected to fix the file and the page to recover.
    .catch((error: unknown) => {
      cache.delete(locale);
      throw error;
    });

  cache.set(locale, pending);
  return pending;
}

export async function getPrograms(locale: Locale): Promise<readonly ProgramEntry[]> {
  return (await getCollections(locale)).programs;
}

export async function getTeachers(locale: Locale): Promise<readonly TeacherEntry[]> {
  return (await getCollections(locale)).teachers;
}

export async function getGallery(locale: Locale): Promise<GalleryEntries> {
  return (await getCollections(locale)).gallery;
}

export async function getTestimonials(locale: Locale): Promise<readonly TestimonialEntry[]> {
  return (await getCollections(locale)).testimonials;
}

export async function getMenu(locale: Locale): Promise<MenuEntries> {
  return (await getCollections(locale)).menu;
}

export async function getFaq(locale: Locale): Promise<readonly FaqEntry[]> {
  return (await getCollections(locale)).faq;
}
