import { NextIntlClientProvider } from "next-intl";
import { prerender } from "react-dom/static";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { reference } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";
import { pathFor } from "@/lib/seo/urls";

/**
 * The Team page (PR-6.7; 04 §3.6, 06 `D-06.1`/`D-06.10`;
 * `docs/design/desktop/…` L548–L574, `docs/design/mobile/…` L441–L468).
 *
 * "Staff" is Team (06 `D-06.1`): one page, the `team` namespace, and the one
 * route whose home anchor is not its own id. What this suite owns:
 *
 * - **the shell is composed, not re-implemented** — one `<main id="main">`, the
 *   kicker from `team.kicker`, and a Back target read off `site.routes[]`
 *   rather than assumed to be `#team`;
 * - **the head teacher leads, and she is chosen by data.** `site.teachers[].head`
 *   picks her, not a name (`D-04.18`), and this page's DOM order is hers-first
 *   where the home section's is `site.teachers[]` order;
 * - **only she has a photograph** — 02's photo-slot rule gives one teacher a
 *   `photo`, and there is no assistant slot in either reference;
 * - **no view is a branch in code** (`D-04.5`) — `bio`/`bioShort` both render
 *   and `md:` picks, and the third tag is a CSS toggle;
 * - **`uppercase` is CSS only** (04 §5.5): both role labels reach the DOM in
 *   the case `team.roles.*` authored them;
 * - the page publishes the canonical `site.routes[]` gives it, in every locale.
 *
 * ── Why the page is prerendered rather than mounted ──────────────────────
 *
 * `TeamBio` is an async Server Component — it awaits `getTeachers(locale)` — so
 * there is no client render of `<TeamPage />`. `react-dom/static` renders the
 * real page, and the HTML is then handed to jsdom so the assertions can be
 * about elements and classes instead of substrings. `tests/unit/sections/
 * HomePage.test.tsx` prerenders for the same reason.
 *
 * ── The three shims ──────────────────────────────────────────────────────
 *
 * `ViewTransition` is not exported by the published `react` package;
 * `next-intl/server` resolves to next-intl's client build outside the
 * `react-server` condition, where every entry point throws (the replacement is
 * PR-6.8's `tests/unit/seo/intl-server.ts`, next-intl's own translator over the
 * real content tree); and `src/content/collections.ts` refuses to load where
 * `window` exists (02 `D-02.16`), which jsdom is. All three replace a
 * *transport*: every teacher, flag, glyph and string below still comes from
 * `content/site.json` and `content/en/collections/teachers.json`.
 */

/** Doctored content, so the "no head teacher" guard can be reached. */
const fixture = vi.hoisted(() => ({ dropHead: false }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    ViewTransition: ({ children }: { children?: ReactNode }) =>
      actual.createElement("div", { "data-testid": "view-transition" }, children),
  };
});

vi.mock("next-intl/server", async () => {
  const { createIntlServerStub } = await import("../seo/intl-server");
  return createIntlServerStub();
});

vi.mock("@/content/collections", async () => {
  const { getSite: site } = await import("@/content/site");
  const { reference: tree } = await import("@/i18n/messages");

  const text: Readonly<Record<string, TeacherCopy>> = tree.collections.teachers;

  return {
    getTeachers: () =>
      Promise.resolve(
        site().teachers.map((shared) => ({
          ...shared,
          head: fixture.dropHead ? false : shared.head,
          text: text[shared.id] ?? {
            name: shared.id,
            summary: shared.id,
            bio: shared.id,
            tags: [],
          },
        })),
      ),
  };
});

/**
 * The collection's per-locale text, as the page reads it. Written out rather
 * than inferred from the JSON so an id that happens to carry every optional
 * field does not make the optional ones look required.
 */
type TeacherCopy = {
  readonly name: string;
  readonly credentials?: string;
  readonly summary: string;
  readonly summaryShort?: string;
  readonly bio: string;
  readonly bioShort?: string;
  readonly tags: readonly string[];
  readonly photoAlt?: string;
};

const { default: TeamPage, generateMetadata } = await import("@/app/[locale]/team/page");
const { getSite } = await import("@/content/site");

const EN = routing.defaultLocale;
const copy = reference.team;
const collection: Readonly<Record<string, TeacherCopy>> = reference.collections.teachers;

/** One teacher's `en` text, by id — the reference every expectation is read from. */
function copyFor(id: string): TeacherCopy {
  const text = collection[id];
  if (text === undefined) throw new Error(`content/en/collections/teachers.json has no "${id}"`);
  return text;
}

const head = getSite().teachers.find((teacher) => teacher.head);
const assistants = getSite().teachers.filter((teacher) => !teacher.head);

beforeEach(() => {
  fixture.dropHead = false;
  resetRevealRegistry();
  document.body.innerHTML = "";
});

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let html = "";
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    html += decoder.decode(chunk, { stream: true });
  }
  return html + decoder.decode();
}

/**
 * The page, rendered inside the two providers `app/[locale]/layout.tsx`
 * supplies, and parked in the document so the assertions can query it.
 */
async function renderPage(locale: Locale = EN): Promise<void> {
  const { prelude } = await prerender(
    <NextIntlClientProvider
      locale={locale}
      messages={reference}
      formats={formats}
      timeZone={TIME_ZONE}
    >
      <MotionProvider>
        <TeamPage />
      </MotionProvider>
    </NextIntlClientProvider>,
  );

  document.body.innerHTML = await drain(prelude);
}

/** The one element `querySelector` is asked for, narrowed. */
function one(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`nothing matched ${selector}`);
  return element;
}

function all(selector: string): readonly HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(selector)];
}

/* -------------------------------------------------------------------------- *
 * The shell
 * -------------------------------------------------------------------------- */

describe("the page shell", () => {
  it("composes SubpageBar rather than re-implementing it", async () => {
    await renderPage();

    expect(all("main#main")).toHaveLength(1);
    expect(one("[data-subpage]")).toHaveAttribute("data-subpage", "team");
    expect(document.body.textContent).toContain(copy.kicker);
  });

  it("points Back at #teachers — the route id and the home anchor differ here", async () => {
    const route = getSite().routes.find((entry) => entry.id === "team");
    expect(route?.homeAnchor).not.toBe(route?.id);

    await renderPage();

    expect(one("main#main")).toBeInTheDocument();
    expect(one("a[href]")).toHaveAttribute("href", `/${EN}#${route?.homeAnchor ?? ""}`);
  });

  it("gives the page one h1, the shell's, and the eyebrow the design draws", async () => {
    await renderPage();

    expect(all("h1")).toHaveLength(1);

    const heading = one("h1");
    expect(heading).toHaveTextContent(copy.heading);
    expect(heading).toHaveAttribute("id", "team-title");
    expect(heading.parentElement).toHaveTextContent(copy.eyebrow);
  });

  it("caps and re-spaces the column to this page's own reference", async () => {
    await renderPage();

    expect(one("main#main")).toHaveClass("max-w-220!", "gap-4!", "md:gap-6!");
  });
});

/* -------------------------------------------------------------------------- *
 * The head teacher
 * -------------------------------------------------------------------------- */

describe("the head teacher", () => {
  it("leads the DOM, which the home section's composition does not", async () => {
    await renderPage();

    const names = all("h2").map((node) => node.textContent);
    expect(names.at(0)).toBe(copyFor(head?.id ?? "").name);
    expect(names.slice(1)).toEqual(assistants.map((teacher) => copyFor(teacher.id).name));
  });

  it("is the only teacher with a photo slot, and it carries her own alt", async () => {
    await renderPage();

    const slots = all("[data-photo-slot]");
    expect(slots).toHaveLength(1);
    expect(slots[0]).toHaveAttribute("data-photo-slot", head?.id ?? "");
    expect(slots[0]).toHaveAttribute("aria-label", copyFor(head?.id ?? "").photoAlt ?? "");
  });

  it("badges her with team.roles.head in the case content authored it", async () => {
    await renderPage();

    // The words reach the DOM sentence-case; `Eyebrow`'s recipe is the only
    // thing that upper-cases them (04 §5.5).
    expect(copy.roles.head).not.toBe(copy.roles.head.toUpperCase());
    const badge = one("h2 + span");
    expect(badge).toHaveTextContent(copy.roles.head);
    expect(badge).toHaveClass("bg-sage");
    expect(badge.firstElementChild).toHaveClass("uppercase", "text-white!");
  });

  it("renders both bio forms and lets md: pick between them (D-04.5)", async () => {
    const text = copyFor(head?.id ?? "");
    expect(text.bioShort).toBeDefined();

    await renderPage();

    const bios = all("main#main p");
    const short = bios.find((node) => node.textContent === text.bioShort);
    const long = bios.find((node) => node.textContent === text.bio);

    expect(short).toHaveClass("md:hidden");
    expect(long).toHaveClass("hidden", "md:block");
  });

  it("drops the third tag below md and keeps the first two on both views", async () => {
    const tags = copyFor(head?.id ?? "").tags;
    expect(tags).toHaveLength(3);

    await renderPage();

    const chips = all("main#main ul li > span").filter((node) =>
      tags.includes(node.textContent ?? ""),
    );

    expect(chips).toHaveLength(tags.length);
    expect(chips[0]).not.toHaveClass("hidden!");
    expect(chips[1]).not.toHaveClass("hidden!");
    expect(chips[2]).toHaveClass("hidden!", "md:inline-flex!");
  });

  it("fails loudly when content marks no head teacher", async () => {
    fixture.dropHead = true;

    await expect(renderPage()).rejects.toThrow(/marks no teacher with head: true/u);
  });
});

/* -------------------------------------------------------------------------- *
 * The assistants and the footnote
 * -------------------------------------------------------------------------- */

describe("the assistants", () => {
  it("draws one card each, in site.teachers[] order, with its own glyph", async () => {
    await renderPage();

    const cards = [...one("main#main > ul").children];
    expect(cards).toHaveLength(assistants.length);

    for (const [index, teacher] of assistants.entries()) {
      const card = cards[index];
      expect(card).toHaveTextContent(copyFor(teacher.id).name);
      expect(card).toHaveTextContent(copyFor(teacher.id).bio);
      expect(card).toHaveTextContent(teacher.icon ?? "");
    }
  });

  it("gives every assistant the same role line, upper-cased by CSS only", async () => {
    await renderPage();

    const roles = [...one("main#main > ul").querySelectorAll("h2 + p")];
    expect(roles).toHaveLength(assistants.length);

    for (const role of roles) {
      expect(role).toHaveTextContent(copy.roles.assistant);
      expect(role).toHaveClass("uppercase");
    }
  });

  it("closes the page with team.footnote", async () => {
    await renderPage();

    const footnote = one("main#main > p");
    expect(footnote).toHaveTextContent(copy.footnote);
    expect(footnote).toHaveClass("text-center");
  });
});

/* -------------------------------------------------------------------------- *
 * Metadata
 * -------------------------------------------------------------------------- */

describe("the page's metadata", () => {
  it("publishes the canonical site.routes[] gives it, in every locale", async () => {
    const href = getSite().routes.find((route) => route.id === "team")?.path ?? "";

    for (const locale of routing.locales) {
      const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });
      expect(metadata.alternates?.canonical).toBe(pathFor(locale, href));
    }
  });

  it("takes its title and description from team.meta.*, never from a literal", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: EN }) });

    expect(metadata.title).toBe(copy.meta.title);
    expect(metadata.description).toBe(copy.meta.description);
  });
});
