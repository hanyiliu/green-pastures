import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import { getSite } from "@/content/site";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { reference } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";

import {
  installIntersectionObserverStub,
  type IntersectionObserverStub,
} from "../../motion/harness";

/**
 * The Teachers section (04 §3.5, §4, §6; 05 §5.3; `docs/design/desktop/README.md`
 * §7 and `docs/design/mobile/README.md` §7).
 *
 * Five of these checks are the row's own acceptance, and every one is about
 * something a green build cannot see:
 *
 * - the **DOM order is `site.teachers[]`** and the mobile reordering is CSS —
 *   `order-first` on the head teacher's frame and nothing else — so the reading
 *   order and the stagger sequence stay put while the drawing changes (04 §4);
 * - **only the head teacher has a photo slot.** There is no assistant slot in
 *   either reference, and what decides it is `site.teachers[].head`, never a
 *   name (`D-04.18`);
 * - **`team.roles.*` is upper-cased by CSS only.** The words reach the DOM in
 *   the case the content tree authored them, and every `uppercase` on the page
 *   arrives through the `Eyebrow` recipe (04 §5.5, 03 §3.3);
 * - **both copy toggles render both strings** and let `md:` choose, so no view
 *   is a code branch (`D-04.5`, INV-04.4);
 * - the section adds **no second IntersectionObserver** (INV-05.9).
 *
 * Every expectation is derived from `content/` — `site.json`, the message tree,
 * the teachers collection — rather than typed out, so the suite catches a
 * section that stopped agreeing with the content rather than one that agrees
 * with itself.
 *
 * **Why two modules are mocked.** `src/content/collections.ts` refuses to load
 * where `window` exists (02 `D-02.16`) and this file is jsdom; and
 * `next-intl/server`'s `getTranslations` is declared `() => never` outside the
 * `react-server` condition, which Vitest is not. Both seams are filled from the
 * real content tree — `getSite()`, `loadMessages()` — so the mocks replace the
 * *transport*, not the data.
 */

const fixture = vi.hoisted(() => ({
  locale: "en",
  dropHead: false,
  dropIcons: false,
  dropCredentials: false,
  dropSummaryShort: false,
}));

vi.mock("next-intl/server", async () => {
  const { loadMessages } = await import("@/i18n/messages");

  /** `t(key)` over a namespace of the assembled tree — no ICU in this section. */
  async function translator(namespace: string) {
    const tree: unknown = await loadMessages(fixture.locale as Locale);

    return (key: string): string => {
      let node: unknown = tree;
      for (const segment of `${namespace}.${key}`.split(".")) {
        node = typeof node === "object" && node !== null ? Reflect.get(node, segment) : undefined;
      }
      return typeof node === "string" ? node : `${namespace}.${key}`;
    };
  }

  return {
    getLocale: () => Promise.resolve(fixture.locale),
    getTranslations: translator,
  };
});

vi.mock("@/content/collections", async () => {
  const { getSite: site } = await import("@/content/site");
  const { reference: tree } = await import("@/i18n/messages");

  const text: Readonly<Record<string, TeacherCopy>> = tree.collections.teachers;

  return {
    getTeachers: () =>
      Promise.resolve(
        site().teachers.map((shared) => {
          const copy = text[shared.id] ?? { name: shared.id, summary: shared.id, tags: [] };

          return {
            ...shared,
            head: fixture.dropHead ? false : shared.head,
            icon: fixture.dropIcons ? undefined : shared.icon,
            text: {
              ...copy,
              credentials: fixture.dropCredentials ? undefined : copy.credentials,
              summaryShort: fixture.dropSummaryShort ? undefined : copy.summaryShort,
            },
          };
        }),
      ),
  };
});

/**
 * The collection's per-locale text, as the section reads it. Written out rather
 * than inferred from the JSON so an id that happens to carry every optional
 * field does not make the optional ones look required.
 */
type TeacherCopy = {
  readonly name: string;
  readonly credentials?: string;
  readonly summary: string;
  readonly summaryShort?: string;
  readonly tags: readonly string[];
  readonly photoAlt?: string;
};

const { default: TeachersSection } = await import("@/components/sections/teachers/TeachersSection");

let observer: IntersectionObserverStub;

beforeAll(() => {
  observer = installIntersectionObserverStub();
});

beforeEach(() => {
  fixture.locale = routing.defaultLocale;
  fixture.dropHead = false;
  fixture.dropIcons = false;
  fixture.dropCredentials = false;
  fixture.dropSummaryShort = false;
  resetRevealRegistry();
});

async function renderTeachers(locale: Locale = routing.defaultLocale) {
  fixture.locale = locale;
  const tree = await TeachersSection();

  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={reference}
      formats={formats}
      timeZone={TIME_ZONE}
    >
      <MotionProvider>{tree}</MotionProvider>
    </NextIntlClientProvider>,
  );
}

const shared = getSite().teachers;
const copy = reference.home.teachers;
const roles = reference.team.roles;
const collection: Readonly<Record<string, TeacherCopy>> = reference.collections.teachers;

/** One teacher's `en` text, by id — the reference every expectation is read from. */
function copyFor(id: string): TeacherCopy {
  const text = collection[id];
  if (text === undefined) throw new Error(`content/en/collections/teachers.json has no "${id}"`);
  return text;
}

/** The frame `TeacherFrame` renders for the teacher at this position. */
function frame(index: number): HTMLElement {
  const element = document.querySelector(`[data-deco="deco-teachers-frame-${String(index + 1)}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`no frame at ${String(index)}`);
  return element;
}

/** The one teacher `site.json` flags as the head teacher, and where she sits. */
const headIndex = shared.findIndex((teacher) => teacher.head);

describe("the section shell", () => {
  it("is the teachers Section, labelled by its own h2 (INV-04.8)", async () => {
    await renderTeachers();

    const section = document.querySelector("section#teachers");
    expect(section).toHaveAttribute("data-section", "teachers");
    expect(section).toHaveAttribute("aria-labelledby", "teachers-title");
    expect(screen.getByRole("heading", { level: 2, name: copy.title })).toHaveAttribute(
      "id",
      "teachers-title",
    );
  });

  it("draws the two leaves the references give it, both static (04 §3.4)", async () => {
    await renderTeachers();

    const leaves = document.querySelectorAll('[data-deco^="deco-teachers-leaf-"]');
    expect(leaves).toHaveLength(2);
    for (const leaf of leaves) expect(leaf.querySelector("svg")).not.toHaveClass("loop");
  });

  it("closes with the link the content tree names, resolved through site.routes[]", async () => {
    const team = getSite().routes.find((route) => route.id === "team");
    expect(team).toBeDefined();

    await renderTeachers();

    expect(screen.getByRole("link", { name: copy.link })).toHaveAttribute(
      "href",
      `/${routing.defaultLocale}${team?.path ?? ""}`,
    );
  });

  it("adds no second IntersectionObserver (INV-05.9)", async () => {
    await renderTeachers();

    expect(observer.constructed).toHaveLength(1);
  });
});

describe("one DOM order, two drawings (04 §4)", () => {
  it("renders the three teachers in site.teachers[] order, as h3 names", async () => {
    await renderTeachers();

    const names = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);
    expect(names).toEqual(shared.map((teacher) => copyFor(teacher.id).name));
  });

  it("puts the head teacher first below lg with order alone, and hands it back at lg", async () => {
    expect(headIndex).toBeGreaterThan(0);

    await renderTeachers();

    expect(frame(headIndex)).toHaveClass("order-first", "lg:order-none");
    for (const [index] of shared.entries()) {
      if (index === headIndex) continue;
      expect(frame(index).className).not.toMatch(/(^|\s|:)order-/u);
    }
  });

  it("holds no interactive content in a frame, which is what makes the reorder safe", async () => {
    await renderTeachers();

    for (const [index] of shared.entries()) {
      expect(frame(index).querySelectorAll("a, button, input, [tabindex]")).toHaveLength(0);
    }
  });

  it("gives every frame the deco identity INV-05.5 asks for, numbered by position", async () => {
    await renderTeachers();

    for (const [index] of shared.entries()) {
      expect(frame(index)).toHaveAttribute("id", `deco-teachers-frame-${String(index + 1)}`);
    }
  });
});

describe("only the head teacher has a photograph", () => {
  it("renders one photo slot, on the teacher site.json flags as head", async () => {
    await renderTeachers();

    const slots = document.querySelectorAll("[data-photo-slot]");
    expect(slots).toHaveLength(1);
    expect(slots[0]).toHaveAttribute("data-photo-slot", shared[headIndex]?.id ?? "");
  });

  it("gives the assistants a decorative icon dot from site.json instead", async () => {
    await renderTeachers();

    for (const assistant of shared.filter((teacher) => !teacher.head)) {
      expect(assistant.icon).toBeDefined();
      expect(screen.getByText(assistant.icon ?? "")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("drops the dot rather than drawing an empty circle when site.json names no icon", async () => {
    fixture.dropIcons = true;
    await renderTeachers();

    for (const teacher of shared) {
      if (teacher.icon === undefined) continue;
      expect(screen.queryByText(teacher.icon)).toBeNull();
    }
  });

  it("shows no photo slot at all when no teacher is flagged head", async () => {
    fixture.dropHead = true;
    await renderTeachers();

    expect(document.querySelectorAll("[data-photo-slot]")).toHaveLength(0);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(shared.length);
  });
});

describe("team.roles.* is upper-cased by CSS only", () => {
  it("puts the authored case in the DOM for both roles", async () => {
    await renderTeachers();

    expect(screen.getByText(roles.head)).toBeInTheDocument();
    expect(screen.getAllByText(roles.assistant)).toHaveLength(
      shared.filter((teacher) => !teacher.head).length,
    );
  });

  it("applies uppercase through the Eyebrow recipe and nowhere else (04 §5.5)", async () => {
    await renderTeachers();

    const uppercased = document.querySelectorAll(".uppercase");
    expect(uppercased.length).toBeGreaterThan(0);
    for (const element of uppercased) {
      expect(element.className).toMatch(/\btext-(eyebrow|eyebrow-sm|panel-label)\b/u);
    }
  });

  it("renders the credential line through the same recipe", async () => {
    await renderTeachers();

    const credentials = copyFor(shared[headIndex]?.id ?? "").credentials;
    expect(credentials).toBeDefined();
    expect(screen.getByText(credentials ?? "")).toHaveClass("uppercase");
  });

  it("omits the credential line when the locale supplies none", async () => {
    const credentials = copyFor(shared[headIndex]?.id ?? "").credentials;
    fixture.dropCredentials = true;
    await renderTeachers();

    expect(screen.queryByText(credentials ?? "")).toBeNull();
  });
});

describe("per-view copy is CSS, never a branch (D-04.5)", () => {
  it("renders both halves of the section intro", async () => {
    await renderTeachers();

    expect(screen.getByText(copy.introShort)).toHaveClass("md:hidden");
    expect(screen.getByText(copy.intro)).toHaveClass("hidden", "md:block");
  });

  it("renders both halves of every card blurb", async () => {
    await renderTeachers();

    for (const teacher of shared) {
      const text = copyFor(teacher.id);
      expect(screen.getByText(text.summaryShort ?? "")).toHaveClass("md:hidden");
      expect(screen.getByText(text.summary)).toHaveClass("hidden", "md:block");
    }
  });

  it("renders one unconditional blurb when the locale supplies no short form", async () => {
    fixture.dropSummaryShort = true;
    await renderTeachers();

    for (const teacher of shared) {
      const blurb = screen.getByText(copyFor(teacher.id).summary);
      expect(blurb).not.toHaveClass("hidden");
      expect(blurb).not.toHaveClass("md:hidden");
    }
  });
});

describe("every locale renders its own copy (04 §8)", () => {
  it.each(routing.locales)("renders %s with no locale branch in the section", async (locale) => {
    vi.stubEnv("NODE_ENV", "production");
    await renderTeachers(locale);
    vi.unstubAllEnvs();

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(shared.length);
    expect(screen.getByRole("link").getAttribute("href")).toMatch(new RegExp(`^/${locale}/`, "u"));
  });
});
