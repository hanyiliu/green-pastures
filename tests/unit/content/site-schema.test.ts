import { describe, expect, it } from "vitest";

import { isPendingLocalePath, SiteSchema } from "@/content/schemas/site";
import { LOCALE_IDS, routing } from "@/i18n/routing";

import siteJson from "../../../content/site.json";

/**
 * `content/site.json`'s schema (02 `D-02.12`, `D-02.20`; INV-02.3, INV-02.10).
 *
 * The shipped file is the fixture: every case below is a clone of it with one
 * thing broken, so a test can never drift from the contract the owner edits.
 * Three kinds of rule are pinned — strict shape, cross-references, and the
 * provisional registry.
 */

type Ref = { src: string; width: number; height: number };
type NavItem = { id: string; routeId?: string; href?: string };

/** A mutable mirror of the shipped file — loose where a test needs to break it. */
type Draft = {
  brand: { name: Record<string, string>; shortName: Record<string, string>; url: string };
  contact: {
    phone: string;
    phoneDisplay: string;
    email: string;
    address: Record<string, string>;
    mapsUrl: string;
  };
  email: { sendingDomain: string; fromAddress: string; notifyTo?: string };
  license: string;
  hours: { days: string[]; open: string; close: string };
  timeZone: string;
  ages: { minMonths: number; maxMonths: number };
  yelp?: { rating: number; reviewCount: number; url: string };
  social?: Record<string, string>;
  routes: Array<{ id: string; path: string; homeAnchor: string }>;
  nav: { primary: NavItem[]; footer: NavItem[]; cta: { href: string } };
  images: Record<string, Ref>;
  hero: { mealsIcon: string };
  programs: Array<{
    id: string;
    ageMonths: [number, number];
    ratio: [number, number];
    featured?: boolean;
    photo: Ref;
  }>;
  teachers: Array<{ id: string; head?: boolean; icon?: string; photo?: Ref }>;
  gallery: {
    categories: Array<{ id: string; onMobile?: boolean }>;
    photos: Array<{ id: string; category: string; wide?: boolean } & Ref>;
  };
  testimonials: Array<{ id: string; rating: number; onHome?: boolean; onMobile?: boolean }>;
  menu: { days: string[]; meals: string[]; dietary: Array<{ id: string; onHome?: boolean }> };
  principles: Array<{ id: string; icon: string }>;
  dailyRhythm: Array<{ id: string; time: string }>;
  faq: Array<{ id: string; topic?: string }>;
  provisional: string[];
} & Record<string, unknown>;

function draft(mutate: (site: Draft) => void = () => undefined): Draft {
  const site = structuredClone(siteJson) as unknown as Draft;
  mutate(site);
  return site;
}

function complaints(value: unknown): string {
  const result = SiteSchema.safeParse(value);
  if (result.success) return "";
  return result.error.issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n");
}

function accepts(value: unknown): boolean {
  return SiteSchema.safeParse(value).success;
}

/** The one path form every provisional test varies. */
function withProvisional(...paths: string[]): Draft {
  return draft((site) => {
    site.provisional = paths;
  });
}

describe("the shipped content/site.json", () => {
  it("parses", () => {
    expect(complaints(siteJson)).toBe("");
  });

  it("applies the terse-file defaults rather than making the owner type them", () => {
    const site = SiteSchema.parse(siteJson);
    expect(site.programs[0]?.featured).toBe(false);
    expect(site.teachers[0]?.head).toBe(false);
    expect(site.gallery.categories[0]?.onMobile).toBe(true);
    expect(site.testimonials[0]?.onHome).toBe(true);
    expect(site.menu.dietary[0]?.onHome).toBe(true);
  });
});

describe("strict shape (02 D-02.12)", () => {
  it("rejects an unknown top-level key rather than ignoring the owner's line", () => {
    const site = draft((value) => {
      value.tagline = "Where little ones grow";
    });
    expect(complaints(site)).toContain("unrecognized_keys");
  });

  it("rejects an unknown nested key", () => {
    const site = draft((value) => {
      value.contact.address.zip = "94538";
    });
    expect(complaints(site)).toContain("unrecognized_keys");
  });

  it.each([
    ["contact.phone that is not E.164", (site: Draft) => (site.contact.phone = "510-555-0142")],
    ["a sendingDomain with a scheme", (site: Draft) => (site.email.sendingDomain = "https://x.io")],
    ["a country that is not alpha-2", (site: Draft) => (site.contact.address.country = "USA")],
    ["a timeZone that is not IANA", (site: Draft) => (site.timeZone = "PST")],
    ["a licence with punctuation", (site: Draft) => (site.license = "000 000")],
    ["a brand.url that is not a URL", (site: Draft) => (site.brand.url = "greenpastures")],
    ["an empty routes[]", (site: Draft) => (site.routes = [])],
    ["hours that close before they open", (site: Draft) => (site.hours.close = "06:00")],
    ["an age band that runs backwards", (site: Draft) => (site.ages.minMonths = 90)],
    [
      "a programme whose ageMonths run backwards",
      (site: Draft) => (site.programs[0]!.ageMonths = [18, 6]),
    ],
  ])("rejects %s", (_label, mutate) => {
    expect(accepts(draft(mutate))).toBe(false);
  });

  it("keeps yelp and social optional", () => {
    const site = draft((value) => {
      delete value.yelp;
      delete value.social;
      value.provisional = value.provisional.filter((path) => !path.startsWith("yelp."));
    });
    expect(complaints(site)).toBe("");
  });

  it("will not let a deleted optional block leave its provisional markers behind", () => {
    const site = draft((value) => {
      delete value.yelp;
    });
    expect(complaints(site)).toContain('Provisional path "yelp.rating" resolves to nothing');
  });

  it("accepts the reserved, empty faq[] (D-02.17)", () => {
    expect(SiteSchema.parse(siteJson).faq).toStrictEqual([]);
  });
});

describe("localized values in site.json (D-02.19, INV-02.3)", () => {
  it("requires brand.name in every enabled locale", () => {
    const [, second] = routing.locales;
    const site = draft((value) => {
      delete value.brand.name[String(second)];
    });
    expect(complaints(site)).toContain("invalid_type");
  });

  it("rejects a brand name for a locale routing.ts has not enabled", () => {
    const enabled: readonly string[] = routing.locales;
    const held = LOCALE_IDS.find((id) => !enabled.includes(id));
    expect(held).toBeDefined();
    const site = draft((value) => {
      value.brand.name[String(held)] = "優朵幼兒園";
    });
    expect(complaints(site)).toContain("unrecognized_keys");
  });
});

describe("cross-references (INV-02.3)", () => {
  it("rejects a nav item whose routeId is not in routes[]", () => {
    const site = draft((value) => {
      value.nav.primary[0] = { id: "philosophy", routeId: "nowhere" };
    });
    expect(complaints(site)).toContain('routeId "nowhere" is not an id in routes[]');
  });

  it("checks the footer group as well as the primary one", () => {
    const site = draft((value) => {
      value.nav.footer[0] = { id: "philosophy", routeId: "nowhere" };
    });
    expect(complaints(site)).toContain("nav.footer[0].routeId");
  });

  it.each([
    ["both routeId and href", { id: "contact", routeId: "team", href: "/#visit" }],
    ["neither routeId nor href", { id: "contact" }],
  ])("rejects a nav item naming %s", (_label, item) => {
    const site = draft((value) => {
      value.nav.footer[0] = item;
    });
    expect(complaints(site)).toContain("exactly one of routeId");
  });

  it("rejects a duplicate nav id, because the label is common.nav.<id>", () => {
    const site = draft((value) => {
      value.nav.primary.push({ id: "philosophy", routeId: "team" });
    });
    expect(complaints(site)).toContain('Duplicate nav id "philosophy"');
  });

  it.each([
    ["routes", (site: Draft) => site.routes.push({ ...site.routes[0]!, homeAnchor: "elsewhere" })],
    ["programs", (site: Draft) => site.programs.push({ ...site.programs[0]! })],
    ["teachers", (site: Draft) => site.teachers.push({ id: site.teachers[0]!.id })],
    ["testimonials", (site: Draft) => site.testimonials.push({ ...site.testimonials[0]! })],
    ["principles", (site: Draft) => site.principles.push({ ...site.principles[0]! })],
    ["dailyRhythm", (site: Draft) => site.dailyRhythm.push({ ...site.dailyRhythm[0]! })],
    ["gallery.photos", (site: Draft) => site.gallery.photos.push({ ...site.gallery.photos[0]! })],
    [
      "gallery.categories",
      (site: Draft) => site.gallery.categories.push({ ...site.gallery.categories[0]! }),
    ],
    ["menu.dietary", (site: Draft) => site.menu.dietary.push({ ...site.menu.dietary[0]! })],
  ])("rejects a duplicate id in %s — ids are the join key", (_label, mutate) => {
    expect(complaints(draft(mutate))).toContain("Duplicate id");
  });

  it("rejects two routes sharing a home anchor", () => {
    const site = draft((value) => {
      value.routes[1]!.homeAnchor = value.routes[0]!.homeAnchor;
    });
    expect(complaints(site)).toContain("share the home anchor");
  });

  it.each([
    [
      "menu.days",
      (site: Draft) => site.menu.days.push(site.menu.days[0]!),
      'menu.days repeats "mon"',
    ],
    [
      "menu.meals",
      (site: Draft) => site.menu.meals.push(site.menu.meals[0]!),
      'menu.meals repeats "breakfast"',
    ],
    [
      "hours.days",
      (site: Draft) => site.hours.days.push(site.hours.days[0]!),
      'hours.days repeats "mon"',
    ],
  ])("rejects a repeated entry in %s", (_label, mutate, expected) => {
    expect(complaints(draft(mutate))).toContain(expected);
  });

  it("rejects a photo filed under a category gallery.categories[] does not declare", () => {
    const site = draft((value) => {
      value.gallery.photos[0]!.category = "fieldTrips";
    });
    expect(complaints(site)).toContain('category "fieldTrips"');
  });

  it("allows exactly one head teacher", () => {
    const site = draft((value) => {
      for (const teacher of value.teachers) teacher.head = true;
    });
    expect(complaints(site)).toContain("Only one teacher may carry the head badge");
  });

  it("accepts a roster with no head teacher at all", () => {
    const site = draft((value) => {
      for (const teacher of value.teachers) delete teacher.head;
    });
    expect(complaints(site)).toBe("");
  });
});

describe("the provisional registry (02 D-02.20, INV-02.10)", () => {
  it("ships 21 paths and every one of them resolves", () => {
    const site = SiteSchema.parse(siteJson);
    expect(site.provisional).toHaveLength(21);
    expect(complaints(siteJson)).toBe("");
  });

  it("accepts an empty registry — the state --release requires", () => {
    expect(complaints(withProvisional())).toBe("");
  });

  it.each([
    ["a field of site.json", "license"],
    ["a nested field", "contact.address.street"],
    ["a locale-suffixed localized value", `brand.name.${String(routing.locales[1])}`],
    ["an array index", "routes.0.path"],
    ["a collection text field", "collections.teachers.ping.name"],
    ["a gallery category name", "collections.gallery.classroom.name"],
    ["a menu cell", "collections.menu.mon.breakfast"],
    ["a message key", "messages.home.hero.title"],
    ["a deeper message key", "messages.visit.form.errors.required"],
  ])("accepts %s", (_label, path) => {
    expect(complaints(withProvisional(path))).toBe("");
  });

  it.each([
    ["a field that is not there", "contact.instagram"],
    ["a nested miss", "contact.address.county"],
    ["an index past the end", "routes.99.path"],
    ["an index that is not a number", "routes.first.path"],
    ["a walk through a scalar", "license.number"],
    ["the registry itself", "provisional"],
    ["an index into the registry", "provisional.0"],
  ])("rejects %s with the INV-02.10 message", (_label, path) => {
    expect(complaints(withProvisional(path))).toContain("resolves to nothing in content/site.json");
  });

  it("rejects a duplicate entry", () => {
    expect(complaints(withProvisional("license", "license"))).toContain(
      'Duplicate provisional entry "license"',
    );
  });

  it.each([
    ["a collection nobody declares", "collections.recipes.soup.name"],
    ["the bare word collections", "collections"],
  ])("rejects %s", (_label, path) => {
    expect(complaints(withProvisional(path))).toContain("names no known collection");
  });

  it("rejects the bare word messages", () => {
    expect(complaints(withProvisional("messages"))).toContain("must be messages.<namespace>.<key>");
  });

  it.each([
    ["an id site.json never declares", "collections.teachers.nobody.name"],
    ["a path that stops before the field", "collections.teachers.ping"],
    ["a bare collection name", "collections.teachers"],
  ])("rejects %s", (_label, path) => {
    expect(complaints(withProvisional(path))).toContain(
      "must be collections.<name>.<id>.<field> with an id declared in site.json",
    );
  });

  it("rejects every id under the reserved, empty faq collection", () => {
    expect(complaints(withProvisional("collections.faq.tuition.answer"))).toContain(
      "must be collections.<name>.<id>.<field>",
    );
  });

  it("rejects a messages path shorter than namespace plus key", () => {
    expect(complaints(withProvisional("messages.home"))).toContain(
      "must be messages.<namespace>.<key>",
    );
  });

  it("rejects an empty string in the registry", () => {
    expect(accepts(withProvisional(""))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- *
 * Pending locales (08 §3 rule 6)
 * -------------------------------------------------------------------------- */

const enabledLocales: readonly string[] = routing.locales;

/**
 * The locale `routing.ts` knows and has not enabled — `zh-Hant` today
 * (INV-02.11). The first test below asserts it exists, because every case after
 * it is meaningless without one: the day `zh-Hant` is enabled, rule 6 has
 * nothing to exempt and these tests need a held-back locale of their own.
 */
const heldBack = LOCALE_IDS.find((id) => !enabledLocales.includes(id));
const held = String(heldBack);

/** The shipped registry plus one entry — the state a Phase 3 seed edit creates. */
function plusProvisional(...paths: string[]): Draft {
  return draft((site) => {
    site.provisional.push(...paths);
  });
}

describe("isPendingLocalePath (08 §3 rule 6)", () => {
  // Stated against a synthetic pair so the rule is pinned independently of
  // which locales happen to be enabled, and so it reads as the rule rather than
  // as today's configuration.
  const locales = { known: ["en", "de", "fr"], enabled: ["en", "de"] };

  it.each([
    ["a held-back locale suffix", "brand.name.fr", true],
    ["a bare held-back locale id", "fr", true],
    ["an enabled locale suffix", "brand.name.de", false],
    ["the reference locale", "brand.name.en", false],
    ["a locale id nobody knows", "brand.name.fr-CA", false],
    ["a path with no locale suffix", "contact.email", false],
    ["a collections path (rule 2 gives the head the vote)", "collections.teachers.ping.fr", false],
    ["a messages path (likewise)", "messages.home.hero.fr", false],
    ["the empty path", "", false],
  ])("%s → %s", (_label, path, expected) => {
    expect(isPendingLocalePath(path, locales)).toBe(expected);
  });

  it("defaults to the project's own locales, never a literal list (INV-08.4)", () => {
    expect(isPendingLocalePath(`brand.name.${held}`)).toBe(heldBack !== undefined);
    expect(isPendingLocalePath(`brand.name.${String(routing.defaultLocale)}`)).toBe(false);
  });
});

describe("pending-locale registry entries (08 §3 rule 6)", () => {
  it("has a locale to hold back — the premise of every case below", () => {
    expect(heldBack).toBeDefined();
  });

  // The direction that was broken: `validate:content` green, `next build` red.
  it.each([
    ["brand.name", `brand.name.${held}`],
    ["brand.shortName", `brand.shortName.${held}`],
  ])("accepts a %s entry for the held-back locale", (_label, path) => {
    expect(complaints(withProvisional(path))).toBe("");
  });

  it("accepts 02's Phase 3 seed — the shipped registry plus both zh-Hant paths", () => {
    const site = plusProvisional(`brand.name.${held}`, `brand.shortName.${held}`);
    expect(complaints(site)).toBe("");
  });

  it("keeps the exempt entry in the registry, so --release still sees it under R1", () => {
    // Rule 6 exempts the path from *resolution*. If the schema dropped it the
    // launch gate would go green on an entry nobody had cleared.
    const path = `brand.name.${held}`;
    const site = SiteSchema.parse(plusProvisional(path));
    expect(site.provisional).toContain(path);
  });

  it("is the reason the entry cannot resolve: INV-02.3 rejects the value itself", () => {
    // The carve-out is not a convenience — `brand.name` may not carry the key
    // the path names, so the path is unresolvable by construction.
    const site = draft((value) => {
      value.brand.name[held] = "優朵幼兒園";
      value.provisional.push(`brand.name.${held}`);
    });
    expect(complaints(site)).toContain("unrecognized_keys");
  });

  // The direction an over-broad exemption would swallow.
  it.each([
    ["a field that is not there", "contact.instagram"],
    ["a mistyped locale suffix", `brand.name.${held}x`],
    ["a locale-shaped suffix nobody knows", "brand.name.zh"],
    [
      "an enabled locale on a path that resolves to nothing",
      `brand.nmae.${String(routing.locales[1])}`,
    ],
    [
      "an enabled locale walked into a scalar",
      `contact.phoneDisplay.${String(routing.locales[1])}`,
    ],
  ])("still rejects %s", (_label, path) => {
    expect(complaints(withProvisional(path))).toContain("resolves to nothing in content/site.json");
  });

  it("does not exempt a collections path whose last segment is the held locale", () => {
    // Rule 2 gives the first segment the deciding vote, so the locale id is an
    // ordinary key here and the collection still has to exist.
    expect(complaints(withProvisional(`collections.recipes.soup.${held}`))).toContain(
      "names no known collection",
    );
  });

  it("does not exempt a messages path whose last segment is the held locale", () => {
    expect(complaints(withProvisional(`messages.${held}`))).toContain(
      "must be messages.<namespace>.<key>",
    );
  });

  it("still rejects a duplicate of a pending-locale entry (rule 1 outranks rule 6)", () => {
    const path = `brand.name.${held}`;
    expect(complaints(withProvisional(path, path))).toContain(
      `Duplicate provisional entry "${path}"`,
    );
  });

  it("leaves every other cross-reference in force beside a pending-locale entry", () => {
    // An exemption that short-circuited the rest of the refinement would hide
    // real findings behind one held-back locale.
    const site = plusProvisional(`brand.name.${held}`);
    site.nav.primary[0] = { id: "philosophy", routeId: "nowhere" };
    expect(complaints(site)).toContain('routeId "nowhere" is not an id in routes[]');
  });
});
