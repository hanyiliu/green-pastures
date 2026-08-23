// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCollections,
  getFaq,
  getGallery,
  getMenu,
  getPrograms,
  getTeachers,
  getTestimonials,
} from "@/content/collections";
import { getProvisionalPaths, getSite } from "@/content/site";
import { reference } from "@/i18n/messages";

import siteJson from "../../../content/site.json";

/**
 * The two loaders (02 `D-02.7`, `D-02.11`, `D-02.12`, `D-02.16`; INV-02.3).
 *
 * `src/content/collections.ts` refuses to load where `window` exists, so this
 * file declares the node environment — the rule itself is pinned from jsdom in
 * `server-only.test.ts`.
 *
 * The mocked cases below replace `@/i18n/messages` and re-import the loader, so
 * the error paths a well-formed `content/` tree can never reach are still
 * exercised against the real `content/site.json`.
 */

type Tree = Record<string, unknown>;
type CollectionsModule = typeof import("@/content/collections");
type MessagesModule = typeof import("@/i18n/messages");

/** Walk into a cloned tree; every level of the content tree is a plain object. */
function node(tree: Tree, ...path: string[]): Tree {
  let current: Tree = tree;
  for (const key of path) current = current[key] as Tree;
  return current;
}

async function referenceClone(): Promise<Tree> {
  const actual = await vi.importActual<MessagesModule>("@/i18n/messages");
  return structuredClone(actual.reference);
}

async function collectionsWith(mock: {
  reference: unknown;
  loadMessages: () => Promise<unknown>;
}): Promise<CollectionsModule> {
  vi.resetModules();
  vi.doMock("@/i18n/messages", () => mock);
  return import("@/content/collections");
}

function silenceConsoleError() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

let consoleError: ReturnType<typeof silenceConsoleError>;

/** What `console.error` was handed, as plain strings. */
function reported(): string {
  const calls: unknown[][] = consoleError.mock.calls;
  return calls.map((call) => String(call[0])).join("\n");
}

beforeEach(() => {
  consoleError = silenceConsoleError();
});

afterEach(() => {
  vi.doUnmock("@/i18n/messages");
  vi.unstubAllEnvs();
  vi.resetModules();
});

/* -------------------------------------------------------------------------- *
 * src/content/site.ts
 * -------------------------------------------------------------------------- */

describe("getSite (02 D-02.12)", () => {
  it("strips the provisional registry, so it cannot reach the browser", () => {
    const site = getSite();
    expect(Object.hasOwn(site, "provisional")).toBe(false);
    expect(JSON.stringify(site)).not.toContain("provisional");
  });

  it("still exposes the registry to the validator through its own accessor", () => {
    expect(getProvisionalPaths()).toStrictEqual(siteJson.provisional);
    expect(getProvisionalPaths()).toHaveLength(21);
  });

  it("parses once and memoises the result", () => {
    expect(getSite()).toBe(getSite());
    expect(getProvisionalPaths()).toBe(getProvisionalPaths());
  });

  it("keeps the declared order of routes and applies the schema defaults", () => {
    const site = getSite();
    expect(site.routes.map((route) => route.id)).toStrictEqual(
      siteJson.routes.map((route) => route.id),
    );
    expect(site.teachers.find((teacher) => teacher.id === "ping")?.head).toBe(true);
  });
});

/* -------------------------------------------------------------------------- *
 * src/content/collections.ts — the real content tree
 * -------------------------------------------------------------------------- */

describe("the collection accessors over content/en (INV-02.3)", () => {
  it("returns programmes in the order site.json declares, joined with their text", async () => {
    const programs = await getPrograms("en");
    expect(programs.map((entry) => entry.id)).toStrictEqual(
      siteJson.programs.map((entry) => entry.id),
    );
    expect(programs[0]?.text.name).toBe(reference.collections.programs.infant.name);
    expect(programs[0]?.photo.src).toBe(siteJson.programs[0]?.photo.src);
  });

  it("returns teachers in declared order with the badge from site.json", async () => {
    const teachers = await getTeachers("en");
    expect(teachers.map((entry) => entry.id)).toStrictEqual(["reyes", "ping", "chen"]);
    expect(teachers[1]?.head).toBe(true);
    expect(teachers[1]?.text.photoAlt).toBeDefined();
    expect(teachers[0]?.head).toBe(false);
  });

  it("returns testimonials in declared order", async () => {
    const testimonials = await getTestimonials("en");
    expect(testimonials.map((entry) => entry.id)).toStrictEqual(
      siteJson.testimonials.map((entry) => entry.id),
    );
  });

  it("attaches the translated name to every filter chip and every photo", async () => {
    const gallery = await getGallery("en");
    expect(gallery.categories.map((entry) => entry.id)).toStrictEqual(
      siteJson.gallery.categories.map((entry) => entry.id),
    );
    expect(gallery.categories.every((entry) => entry.name.length > 0)).toBe(true);
    expect(gallery.photos.map((entry) => entry.id)).toStrictEqual(
      siteJson.gallery.photos.map((entry) => entry.id),
    );
    expect(gallery.photos[0]?.text.alt.length).toBeGreaterThan(0);
  });

  it("returns the week and the dietary chips in site.json's order", async () => {
    const menu = await getMenu("en");
    expect(menu.days).toStrictEqual(siteJson.menu.days);
    expect(menu.meals).toStrictEqual(siteJson.menu.meals);
    expect(menu.dietary.map((entry) => entry.id)).toStrictEqual(
      siteJson.menu.dietary.map((entry) => entry.id),
    );
    expect(typeof menu.week.mon?.breakfast).toBe("string");
  });

  it("returns nothing for the reserved faq namespace", async () => {
    await expect(getFaq("en")).resolves.toStrictEqual([]);
  });

  it("memoises the joined result per locale", async () => {
    await expect(getCollections("en")).resolves.toBe(await getCollections("en"));
  });
});

describe("a locale whose collection files are still {} (02 D-02.8, INV-02.11)", () => {
  it("keeps every id and renders the en text, reporting each gap outside production", async () => {
    const programs = await getPrograms("zh-Hans");
    expect(programs.map((entry) => entry.id)).toStrictEqual(
      siteJson.programs.map((entry) => entry.id),
    );
    expect(programs[0]?.text.name).toBe(reference.collections.programs.infant.name);

    expect(reported()).toContain("[content]");
    expect(reported()).toContain("pnpm validate:content is the gate");
  });
});

/* -------------------------------------------------------------------------- *
 * src/content/collections.ts — the paths a healthy tree cannot reach
 * -------------------------------------------------------------------------- */

describe("the loader's failure paths", () => {
  it("takes display order from site.json, not from the key order of the JSON file", async () => {
    const tree = await referenceClone();
    const programs = node(tree, "collections", "programs");
    node(tree, "collections").programs = Object.fromEntries(Object.entries(programs).reverse());
    expect(Object.keys(node(tree, "collections", "programs"))).toStrictEqual([
      "preschool",
      "toddler",
      "infant",
    ]);

    const module = await collectionsWith({
      reference: tree,
      loadMessages: () => Promise.resolve(tree),
    });
    await expect(
      module.getPrograms("en").then((entries) => entries.map((e) => e.id)),
    ).resolves.toStrictEqual(siteJson.programs.map((entry) => entry.id));
  });

  it("applies a locale's own leaf over the en reference and keeps the rest", async () => {
    const tree = await referenceClone();
    const module = await collectionsWith({
      reference: tree,
      loadMessages: () =>
        Promise.resolve({ collections: { programs: { infant: { name: "婴儿班" } } } }),
    });
    const programs = await module.getPrograms("zh-Hans");
    expect(programs[0]?.text.name).toBe("婴儿班");
    expect(programs[0]?.text.ageLabel).toBe(
      node(tree, "collections", "programs", "infant").ageLabel,
    );
  });

  it("falls back wholesale when the locale tree has no collections at all", async () => {
    const tree = await referenceClone();
    const module = await collectionsWith({
      reference: tree,
      loadMessages: () => Promise.resolve({}),
    });
    await expect(module.getPrograms("zh-Hans")).resolves.toHaveLength(3);
    expect(consoleError).toHaveBeenCalled();
  });

  it("stays silent about gaps in production — the CI gate is the real check", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const tree = await referenceClone();
    const module = await collectionsWith({
      reference: tree,
      loadMessages: () => Promise.resolve({}),
    });
    await expect(module.getPrograms("zh-Hans")).resolves.toHaveLength(3);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("throws when the en collection tree itself is missing", async () => {
    const module = await collectionsWith({
      reference: { collections: "not a tree" },
      loadMessages: () => Promise.resolve({}),
    });
    await expect(module.getPrograms("en")).rejects.toThrow(
      "The en collection tree is missing (02 D-02.7)",
    );
  });

  it("keeps an orphan key so the schema names it, rather than dropping the editor's work", async () => {
    const tree = await referenceClone();
    const module = await collectionsWith({
      reference: tree,
      loadMessages: () =>
        Promise.resolve({
          collections: {
            teachers: {
              nobody: { name: "Ms. Nobody", summary: "…", bio: "…", tags: [] },
            },
          },
        }),
    });
    await expect(module.getTeachers("zh-Hans")).rejects.toThrow(
      /content\/zh-Hans\/collections\/teachers\.json does not match its content schema/,
    );
    await expect(module.getTeachers("zh-Hans")).rejects.toThrow(/nobody/);
  });

  it("refuses a teacher who has a photo in site.json but no alt in this locale", async () => {
    const tree = await referenceClone();
    delete node(tree, "collections", "teachers", "ping").photoAlt;
    const module = await collectionsWith({
      reference: tree,
      loadMessages: () => Promise.resolve(tree),
    });
    await expect(module.getTeachers("en")).rejects.toThrow(
      'teacher "ping" has a photo in content/site.json but no photoAlt (INV-02.3)',
    );
  });

  it("does not memoise a failure — the editor fixes the file and the page recovers", async () => {
    const tree = await referenceClone();
    const loadMessages = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("content/zh-Hans is mid-edit"))
      .mockResolvedValue(tree);
    const module = await collectionsWith({ reference: tree, loadMessages });

    await expect(module.getCollections("zh-Hans")).rejects.toThrow("content/zh-Hans is mid-edit");
    await expect(module.getCollections("zh-Hans")).resolves.toBeDefined();
    expect(loadMessages).toHaveBeenCalledTimes(2);
  });

  it("parses one locale once — the second call reuses the memoised promise", async () => {
    const tree = await referenceClone();
    const loadMessages = vi.fn<() => Promise<unknown>>().mockResolvedValue(tree);
    const module = await collectionsWith({ reference: tree, loadMessages });

    const first = await module.getCollections("en");
    expect(await module.getCollections("en")).toBe(first);
    expect(loadMessages).toHaveBeenCalledTimes(1);
  });
});
