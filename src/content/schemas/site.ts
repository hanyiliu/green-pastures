import { z } from "zod";

import { FaqShared } from "./faq";
import { GalleryShared } from "./gallery";
import { DayId, MenuShared } from "./menu";
import { ProgramShared } from "./programs";
import {
  Emoji,
  Id,
  Image,
  InternalHref,
  LocalizedText,
  PositiveInt,
  RoutePath,
  Text,
  TimeOfDay,
} from "./primitives";
import { TeacherShared } from "./teachers";
import { TestimonialShared } from "./testimonials";

/**
 * `content/site.json` — the ONE locale-agnostic config (02 `D-02.12`).
 *
 * Everything that is not words: brand, contact, the e-mail sending identity,
 * hours, licence, Yelp, nav structure, images, the per-collection ids / order /
 * media / numbers, day and meal ids, and the `provisional` registry of
 * `D-02.20`. The two fields that genuinely read differently per language —
 * `brand.name` and `brand.shortName` — are *localized values*, objects keyed by
 * locale id, not translations in a locale file (`D-02.19`).
 *
 * Three kinds of rule live here, and only the first is ordinary Zod:
 *
 * 1. **Shape.** Every object is strict, so a key the contract does not name is
 *    a parse error rather than a silently ignored line in the owner's file.
 * 2. **Cross-references** (INV-02.3). `nav[].routeId` resolves in `routes[]`,
 *    every gallery photo names a declared category, ids are unique inside their
 *    list, at most one teacher wears the head badge.
 * 3. **The provisional registry** (`D-02.20`, INV-02.10). Every path in
 *    `provisional` must resolve, "so a deleted value cannot leave a stale
 *    marker" — enforced here, in the loader, as well as by `validate:content`.
 *
 * Cross-references that need the *locale* files (a teacher with no text, a
 * photo with no `alt`) are the collections loader's and `validate:content`'s;
 * this schema sees `site.json` alone.
 */

/* -------------------------------------------------------------------------- *
 * Leaf shapes
 * -------------------------------------------------------------------------- */

/** E.164, for `tel:` — `+15105550142`. `phoneDisplay` is what the page prints. */
const PhoneE164 = z.string().regex(/^\+[1-9]\d{7,14}$/, {
  error: "contact.phone is E.164, e.g. +15105550142 (02 D-02.12).",
});

/** A registrable hostname — the Resend-verified sending domain (07). */
const Hostname = z.string().regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/, {
  error: "email.sendingDomain is a bare hostname, e.g. mail.example.com (02 D-02.12).",
});

/** ISO 3166-1 alpha-2. */
const CountryCode = z.string().regex(/^[A-Z]{2}$/, {
  error: "country is an ISO 3166-1 alpha-2 code, e.g. US.",
});

/** An IANA zone id — fixed so server and browser agree on "today" (02 `D-02.6`). */
const TimeZone = z.string().regex(/^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+$/, {
  error: "timeZone is an IANA identifier, e.g. America/Los_Angeles (02 D-02.6).",
});

const Brand = z.strictObject({
  name: LocalizedText,
  shortName: LocalizedText,
  /** The site origin; 06 feeds it to `metadataBase`. */
  url: z.url(),
});

const Address = z.strictObject({
  street: Text,
  city: Text,
  region: Text,
  postalCode: Text,
  country: CountryCode,
});

const Contact = z.strictObject({
  phone: PhoneE164,
  phoneDisplay: Text,
  /** The public inquiry inbox and the default notification recipient. */
  email: z.email(),
  address: Address,
  mapsUrl: z.url(),
});

/**
 * The sending identity 07 uses (HD-4). Deliberately its own block: nothing
 * derives it from `brand.url` and nothing derives `brand.url` from it — the two
 * sharing a registrable domain today is a coincidence of the sample (ADJ-24).
 * The display name is `brand.name[locale]`, never duplicated here.
 */
const EmailIdentity = z.strictObject({
  sendingDomain: Hostname,
  fromAddress: z.email(),
  notifyTo: z.email().optional(),
});

const Hours = z
  .strictObject({
    days: z.array(DayId).min(1),
    open: TimeOfDay,
    close: TimeOfDay,
  })
  .refine((hours) => hours.open < hours.close, {
    error: "hours.open must be earlier than hours.close.",
    path: ["close"],
  });

const Ages = z
  .strictObject({ minMonths: z.number().int().nonnegative(), maxMonths: PositiveInt })
  .refine((ages) => ages.minMonths < ages.maxMonths, {
    error: "ages.minMonths must be below ages.maxMonths.",
    path: ["maxMonths"],
  });

/** Optional block: the whole thing is deleted if the daycare has no Yelp page. */
const Yelp = z.strictObject({
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative(),
  url: z.url(),
});

const Social = z.strictObject({
  instagram: z.url().optional(),
  facebook: z.url().optional(),
  wechat: z.url().optional(),
});

/**
 * The stable mapping the Back control and every "learn more →" link use
 * (02 `D-02.12`; 05's slide, 06's routes). Ids never change.
 */
const Route = z.strictObject({
  id: Id,
  path: RoutePath,
  /** The home-page section this page belongs to — `reviews` → `#testimonials`. */
  homeAnchor: Id,
});

/**
 * A nav entry names *either* a route (label from `common.nav.<id>`) or a raw
 * internal href — the footer's Contact link is `/#visit`, which is a section,
 * not a route.
 */
const NavItem = z
  .strictObject({
    id: Id,
    routeId: Id.optional(),
    href: InternalHref.optional(),
  })
  .refine((item) => (item.routeId === undefined) !== (item.href === undefined), {
    error: "A nav item names exactly one of routeId (an entry in routes[]) or href.",
  });

const Nav = z.strictObject({
  primary: z.array(NavItem).min(1),
  footer: z.array(NavItem).min(1),
  cta: z.strictObject({ href: InternalHref }),
});

const Images = z.strictObject({
  hero: Image,
  philosophy: Image,
  map: Image,
  og: Image,
});

/** The design's meals card. Its icon is a standalone element, so it is data. */
const Hero = z.strictObject({ mealsIcon: Emoji });

/** `{id, icon}` — the three philosophy principles; their copy is in messages. */
const Principle = z.strictObject({ id: Id, icon: Emoji });

/** `{id, time}` — the daily rhythm, formatted with `timeShort` (02 `D-02.6`). */
const RhythmStep = z.strictObject({ id: Id, time: TimeOfDay });

/* -------------------------------------------------------------------------- *
 * The file
 * -------------------------------------------------------------------------- */

const SiteShape = z.strictObject({
  brand: Brand,
  contact: Contact,
  email: EmailIdentity,
  /** The licence number the footer prints on both views (`gp-dln.9`). */
  license: z.string().regex(/^[A-Za-z0-9-]{4,}$/, {
    error: "license is the licence number as it is printed, e.g. 000000000.",
  }),
  hours: Hours,
  timeZone: TimeZone,
  ages: Ages,
  yelp: Yelp.optional(),
  social: Social.optional(),
  routes: z.array(Route).min(1),
  nav: Nav,
  images: Images,
  hero: Hero,
  programs: z.array(ProgramShared).min(1),
  teachers: z.array(TeacherShared).min(1),
  gallery: GalleryShared,
  testimonials: z.array(TestimonialShared).min(1),
  menu: MenuShared,
  principles: z.array(Principle).min(1),
  dailyRhythm: z.array(RhythmStep).min(1),
  /** Reserved and empty until 06 ships the route (02 `D-02.17`). */
  faq: z.array(FaqShared),
  /**
   * The registry of 02 `D-02.20`: dotted paths naming every value that is a
   * sample default. Read by `validate:content` only — `src/content/site.ts`
   * strips it before any client import, so it never reaches the browser.
   */
  provisional: z.array(z.string().min(1)),
});

/* -------------------------------------------------------------------------- *
 * Cross-references (INV-02.3) and the provisional registry (INV-02.10)
 * -------------------------------------------------------------------------- */

type SiteShape = z.infer<typeof SiteShape>;

/** Which ids each `collections.<name>.<id>.<field>` provisional path may name. */
function collectionIds(site: SiteShape): ReadonlyMap<string, ReadonlySet<string>> {
  const ids = (entries: ReadonlyArray<{ readonly id: string }>) =>
    new Set(entries.map((entry) => entry.id));
  return new Map<string, ReadonlySet<string>>([
    ["programs", ids(site.programs)],
    ["teachers", ids(site.teachers)],
    ["testimonials", ids(site.testimonials)],
    ["faq", ids(site.faq)],
    ["gallery", new Set([...ids(site.gallery.photos), ...ids(site.gallery.categories)])],
    ["menu", new Set([...ids(site.menu.dietary), ...site.menu.days])],
  ]);
}

function duplicatesOf(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Walk a dotted path into the parsed file. Returns `undefined` when any segment
 * is absent — which is what makes an unresolvable `provisional` entry an error
 * "in every mode" (02 `D-02.20`).
 *
 * Locale-suffixed paths work by construction: `brand.name.zh-Hans` splits into
 * three segments, the last of which is a key of the localized value.
 */
function resolvePath(root: SiteShape, path: string): unknown {
  let current: unknown = root;
  for (const segment of path.split(".")) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (!isRecord(current) || !Object.hasOwn(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
}

/**
 * The half of Zod's refinement context this file uses. Declared as a method so
 * the real `ctx` — whose `addIssue` accepts far more shapes — is assignable.
 */
interface IssueSink {
  addIssue(issue: { code: "custom"; message: string; path: PropertyKey[] }): void;
}

function checkUniqueIds(
  ctx: IssueSink,
  path: PropertyKey[],
  entries: ReadonlyArray<{ readonly id: string }>,
): void {
  for (const duplicate of duplicatesOf(entries.map((entry) => entry.id))) {
    ctx.addIssue({
      code: "custom",
      message: `Duplicate id "${duplicate}" — ids are the join key with content/<locale>/ (02 D-02.11).`,
      path,
    });
  }
}

function checkNav(site: SiteShape, ctx: IssueSink): void {
  const routeIds = new Set(site.routes.map((route) => route.id));
  for (const group of ["primary", "footer"] as const) {
    site.nav[group].forEach((item, index) => {
      if (item.routeId !== undefined && !routeIds.has(item.routeId)) {
        ctx.addIssue({
          code: "custom",
          message: `nav.${group}[${index}].routeId "${item.routeId}" is not an id in routes[] (02 D-02.12).`,
          path: ["nav", group, index, "routeId"],
        });
      }
    });
    for (const duplicate of duplicatesOf(site.nav[group].map((item) => item.id))) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate nav id "${duplicate}" — the label is common.nav.${duplicate}.`,
        path: ["nav", group],
      });
    }
  }
}

function checkProvisional(site: SiteShape, ctx: IssueSink): void {
  const collections = collectionIds(site);

  for (const duplicate of duplicatesOf(site.provisional)) {
    ctx.addIssue({
      code: "custom",
      message: `Duplicate provisional entry "${duplicate}" — entries are unique (02 D-02.20).`,
      path: ["provisional"],
    });
  }

  site.provisional.forEach((path, index) => {
    const segments = path.split(".");
    const at: PropertyKey[] = ["provisional", index];

    // `collections.<name>.<id>.<field>` — one collection text field, in every
    // locale. The *field* is checked by validate:content, which can read the
    // locale files; the collection and its id must resolve here.
    if (segments[0] === "collections") {
      const [, name, id] = segments;
      const ids = name === undefined ? undefined : collections.get(name);
      if (ids === undefined) {
        ctx.addIssue({
          code: "custom",
          message: `Provisional path "${path}" names no known collection (02 D-02.20).`,
          path: at,
        });
        return;
      }
      if (segments.length < 4 || id === undefined || !ids.has(id)) {
        ctx.addIssue({
          code: "custom",
          message: `Provisional path "${path}" must be collections.<name>.<id>.<field> with an id declared in site.json.`,
          path: at,
        });
      }
      return;
    }

    // `messages.<namespace>.<key>` — a message key, in every locale. Only the
    // grammar is checkable from site.json; validate:content resolves the key.
    if (segments[0] === "messages") {
      if (segments.length < 3) {
        ctx.addIssue({
          code: "custom",
          message: `Provisional path "${path}" must be messages.<namespace>.<key> (02 D-02.20).`,
          path: at,
        });
      }
      return;
    }

    // Anything else is a field of this very file, and it has to be there:
    // "a deleted value cannot leave a stale marker" (02 D-02.20, INV-02.10).
    if (segments[0] === "provisional" || resolvePath(site, path) === undefined) {
      ctx.addIssue({
        code: "custom",
        message: `Provisional path "${path}" resolves to nothing in content/site.json — replace the value and delete this line, or fix the path (INV-02.10).`,
        path: at,
      });
    }
  });
}

export const SiteSchema = SiteShape.superRefine((site, ctx) => {
  checkUniqueIds(ctx, ["routes"], site.routes);
  checkUniqueIds(ctx, ["programs"], site.programs);
  checkUniqueIds(ctx, ["teachers"], site.teachers);
  checkUniqueIds(ctx, ["testimonials"], site.testimonials);
  checkUniqueIds(ctx, ["principles"], site.principles);
  checkUniqueIds(ctx, ["dailyRhythm"], site.dailyRhythm);
  checkUniqueIds(ctx, ["faq"], site.faq);
  checkUniqueIds(ctx, ["gallery", "photos"], site.gallery.photos);
  checkUniqueIds(ctx, ["gallery", "categories"], site.gallery.categories);
  checkUniqueIds(ctx, ["menu", "dietary"], site.menu.dietary);

  for (const duplicate of duplicatesOf(site.routes.map((route) => route.homeAnchor))) {
    ctx.addIssue({
      code: "custom",
      message: `Two routes share the home anchor "#${duplicate}" — the Back control could not tell them apart (02 D-02.12).`,
      path: ["routes"],
    });
  }

  for (const duplicate of duplicatesOf(site.menu.days)) {
    ctx.addIssue({
      code: "custom",
      message: `menu.days repeats "${duplicate}".`,
      path: ["menu", "days"],
    });
  }
  for (const duplicate of duplicatesOf(site.menu.meals)) {
    ctx.addIssue({
      code: "custom",
      message: `menu.meals repeats "${duplicate}".`,
      path: ["menu", "meals"],
    });
  }
  for (const duplicate of duplicatesOf(site.hours.days)) {
    ctx.addIssue({
      code: "custom",
      message: `hours.days repeats "${duplicate}".`,
      path: ["hours", "days"],
    });
  }

  const categoryIds = new Set(site.gallery.categories.map((category) => category.id));
  site.gallery.photos.forEach((photo, index) => {
    if (!categoryIds.has(photo.category)) {
      ctx.addIssue({
        code: "custom",
        message: `Photo "${photo.id}" is filed under category "${photo.category}", which gallery.categories[] does not declare (INV-02.3).`,
        path: ["gallery", "photos", index, "category"],
      });
    }
  });

  const heads = site.teachers.filter((teacher) => teacher.head);
  if (heads.length > 1) {
    ctx.addIssue({
      code: "custom",
      message: `Only one teacher may carry the head badge; ${String(heads.length)} do (02 *Design → Collections → teachers*).`,
      path: ["teachers"],
    });
  }

  checkNav(site, ctx);
  checkProvisional(site, ctx);
});

/** The whole file, `provisional` included — what `validate:content` reads. */
export type Site = z.infer<typeof SiteSchema>;

/**
 * The file as the app sees it: the provisional registry is stripped by
 * `src/content/site.ts` so it can never reach the browser (02 `D-02.12`).
 */
export type SiteConfig = Omit<Site, "provisional">;
