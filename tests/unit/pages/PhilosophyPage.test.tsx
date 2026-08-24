import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { reference } from "@/i18n/messages";
import { routing } from "@/i18n/routing";
import { pathFor } from "@/lib/seo/urls";

import { installIntersectionObserverStub, type IntersectionObserverStub } from "../motion/harness";

/**
 * The Philosophy page (PR-6.2; 04 §3.6, 06 `D-06.1`/`D-06.3`/`D-06.10`;
 * `docs/design/desktop/…` L349–L386, `docs/design/mobile/…` L257–L289).
 *
 * The page composes a shell it does not own, so this suite asserts what is
 * *this row's*, and every expectation is read out of `content/` rather than
 * typed here — a suite that agrees only with itself catches nothing:
 *
 * - **the shell is composed, not re-implemented** — one `<main id="main">`, the
 *   kicker and the Back target from the page's own namespace and
 *   `site.routes[]`, one `h1`;
 * - **the three composites are driven by content** — a card per
 *   `site.principles[]`, a row per `site.dailyRhythm[]`, a badge per key of
 *   `philosophy.badges`, each in the order content lists them;
 * - **not one time is typed.** The visible clock is `site.json`'s `HH:MM` put
 *   through 02's `timeShort` format, and the `datetime` attribute is the stored
 *   value unchanged;
 * - **no view is a branch in code** (`D-04.5`, INV-04.4) — both copy forms
 *   render where the locale has a short one, and the badge row is a CSS toggle;
 * - **a content join that has come apart fails loudly**, naming both files,
 *   instead of drawing `⟦philosophy.principles.x.title⟧` in a card;
 * - the page adds **no second IntersectionObserver** (INV-05.9).
 *
 * ── The two shims ────────────────────────────────────────────────────────
 *
 * `ViewTransition` is not exported by the published `react` package — it comes
 * from the canary build Next vendors — so `PageTransition` resolves to an
 * `undefined` element type here. `tests/unit/sections/HomePage.test.tsx` and
 * `tests/unit/motion/PageTransition.test.tsx` install the same one-line shim.
 *
 * `next-intl/server` resolves to next-intl's *client* build outside Next's
 * `react-server` condition, where every server entry point is a hard throw, so
 * `generateMetadata` cannot run without a replacement. The replacement is
 * PR-6.8's own `tests/unit/seo/intl-server.ts` — next-intl's `createTranslator`
 * over the real content tree — rather than a third copy of the same twenty
 * lines. Nothing the page renders goes through it: every composite reads its
 * messages through the client provider below, exactly as it does in a Server
 * Component.
 */

/** Doctored content, so the two join guards can be reached. Hoisted for `vi.mock`. */
const fixture = vi.hoisted(() => ({ strayPrinciple: false, strayStep: false }));

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

/**
 * `content/site.json`, with one unmatched principle or rhythm step appended on
 * request. The rest of the file is the real thing — `SubpageBar` reads
 * `routes[]` through the same accessor — so only the join under test moves.
 */
vi.mock("@/content/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/content/site")>();

  return {
    ...actual,
    getSite: () => {
      const site = actual.getSite();

      return {
        ...site,
        principles: fixture.strayPrinciple
          ? [...site.principles, { id: "notAPrinciple", icon: "🌿" }]
          : site.principles,
        dailyRhythm: fixture.strayStep
          ? [...site.dailyRhythm, { id: "notAStep", time: "23:00" }]
          : site.dailyRhythm,
      };
    },
  };
});

const { default: PhilosophyPage, generateMetadata } =
  await import("@/app/[locale]/philosophy/page");
const { getSite } = await import("@/content/site");

const EN = routing.defaultLocale;
const copy = reference.philosophy;

let observer: IntersectionObserverStub;

beforeAll(() => {
  observer = installIntersectionObserverStub();
});

beforeEach(() => {
  fixture.strayPrinciple = false;
  fixture.strayStep = false;
  resetRevealRegistry();
});

function renderPage() {
  return render(
    <NextIntlClientProvider locale={EN} messages={reference} formats={formats} timeZone={TIME_ZONE}>
      <MotionProvider>
        <PhilosophyPage />
      </MotionProvider>
    </NextIntlClientProvider>,
  );
}

/** The one element `querySelector` is asked for, narrowed. */
function one(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`nothing matched ${selector}`);
  return element;
}

/** One principle's `en` copy, by the id `site.json` names it with. */
function principleCopy(id: string): { readonly title: string; readonly body: string } {
  const text = copy.principles[id as keyof typeof copy.principles] as
    { readonly title: string; readonly body: string } | undefined;

  if (text === undefined) {
    throw new Error(`content/en/messages/philosophy.json has no principle "${id}"`);
  }
  return text;
}

/**
 * The clock a parent reads, computed the way production computes it: the
 * `timeShort` format over a `Date` whose Los Angeles wall clock is the value
 * `site.json` stores. `VisitSection`'s suite mints the same anchor for the same
 * reason — no string here is typed, so the assertion tracks the format.
 */
function clock(time: string): string {
  const parts = time.split(":").map(Number);
  const hours = parts.at(0) ?? 0;
  const minutes = parts.at(1) ?? 0;
  const naive = Date.UTC(2024, 0, 1, hours, minutes);

  const shown = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(naive));
  const shownParts = shown.split(":").map(Number);
  const offset = Date.UTC(2024, 0, 1, shownParts.at(0) ?? 0, shownParts.at(1) ?? 0) - naive;

  return new Intl.DateTimeFormat(EN, { timeZone: TIME_ZONE, ...formats.dateTime.timeShort }).format(
    new Date(naive - offset),
  );
}

/* -------------------------------------------------------------------------- *
 * The shell
 * -------------------------------------------------------------------------- */

describe("the page shell", () => {
  it("composes SubpageBar rather than re-implementing it", () => {
    renderPage();

    expect(document.querySelectorAll("main#main")).toHaveLength(1);
    expect(screen.getByText(copy.kicker)).toBeInTheDocument();
    expect(one("[data-subpage]")).toHaveAttribute("data-subpage", "philosophy");
  });

  it("points Back at this route's own home anchor, from site.routes[]", () => {
    const route = getSite().routes.find((entry) => entry.id === "philosophy");
    renderPage();

    expect(screen.getByRole("link")).toHaveAttribute("href", `/${EN}#${route?.homeAnchor ?? ""}`);
  });

  it("gives the page exactly one h1, and it is the shell's (INV-04.8)", () => {
    renderPage();

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName(copy.heading);
    expect(headings[0]).toHaveAttribute("id", "philosophy-title");
  });

  it("caps the column at the reference's 940px rather than the shared 1080", () => {
    renderPage();

    expect(one("main#main")).toHaveClass("max-w-235!");
  });

  it("releases the header's own bottom margin to the column's gap, both views", () => {
    renderPage();

    const stack = screen.getByRole("heading", { level: 1 }).parentElement;
    expect(stack).toHaveClass("mb-0!", "md:mb-0!");
  });
});

/* -------------------------------------------------------------------------- *
 * The principles
 * -------------------------------------------------------------------------- */

describe("PrinciplesList", () => {
  /** The `<li>`s of the principles list, in DOM order. */
  function cards(): readonly HTMLElement[] {
    return [...one('ul[aria-labelledby="philosophy-principles-title"]').children].filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    );
  }

  it("draws one card per site.principles[], in the order content lists them", () => {
    renderPage();

    const principles = getSite().principles;
    expect(cards()).toHaveLength(principles.length);

    for (const [index, principle] of principles.entries()) {
      const card = cards()[index];
      const text = principleCopy(principle.id);

      expect(card).toHaveTextContent(text.title);
      expect(card).toHaveTextContent(text.body);
      expect(card).toHaveTextContent(principle.icon);
    }
  });

  it("carries the glyph decoratively, on the 40 → 48px tile the design draws", () => {
    renderPage();

    const tile = one('ul[aria-labelledby="philosophy-principles-title"] li > span');
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(tile).toHaveClass("size-10!", "md:size-12!");
  });

  it("labels the list with the heading 02 ships and the design does not draw", () => {
    renderPage();

    const heading = one("#philosophy-principles-title");
    expect(heading.tagName).toBe("H2");
    expect(heading).toHaveClass("sr-only");
    expect(heading).toHaveTextContent(copy.principlesHeading);
  });

  it("makes the card titles h3, under that h2 and the page's h1", () => {
    renderPage();

    const titles = screen.getAllByRole("heading", { level: 3 });
    expect(titles.map((node) => node.textContent)).toEqual(
      getSite().principles.map((principle) => principleCopy(principle.id).title),
    );
  });

  it("fails loudly for a principle the message tree has no copy for", () => {
    fixture.strayPrinciple = true;
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(renderPage).toThrow(/philosophy\.json has no title and body for/u);
    errors.mockRestore();
  });
});

/* -------------------------------------------------------------------------- *
 * The daily rhythm
 * -------------------------------------------------------------------------- */

describe("DailyTimeline", () => {
  it("draws one row per site.dailyRhythm[], as an ordered list", () => {
    renderPage();

    const rows = one("ol").children;
    expect(rows).toHaveLength(getSite().dailyRhythm.length);
  });

  it("stores the owner's HH:MM and shows the reader their own clock", () => {
    renderPage();

    for (const step of getSite().dailyRhythm) {
      const time = one(`time[datetime="${step.time}"]`);
      expect(time).toHaveTextContent(clock(step.time));
    }
  });

  it("titles the card from philosophy.dayTitle with the localized brand name", () => {
    renderPage();

    const brandShortName = getSite().brand.shortName[EN];
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: copy.dayTitle.replace("{brandShortName}", brandShortName),
      }),
    ).toBeInTheDocument();
  });

  it("renders both copy forms where the locale has a short one (D-04.5)", () => {
    renderPage();

    // `arrival` is the one step with both a shorter title and a shorter body.
    const arrival = getSite().dailyRhythm.find((step) => step.id === "arrival");
    const row = one(`time[datetime="${arrival?.time ?? ""}"]`).parentElement;
    const sentences = row?.querySelectorAll("p") ?? [];

    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toHaveClass("md:hidden");
    expect(sentences[0]).toHaveTextContent(copy.day.arrival.titleShort);
    expect(sentences[1]).toHaveClass("hidden", "md:block");
    expect(sentences[1]).toHaveTextContent(copy.day.arrival.title);
  });

  it("renders one sentence for a step with no short form, not a duplicate", () => {
    renderPage();

    const rest = getSite().dailyRhythm.find((step) => step.id === "rest");
    const row = one(`time[datetime="${rest?.time ?? ""}"]`).parentElement;
    const sentences = row?.querySelectorAll("p") ?? [];

    expect(sentences).toHaveLength(1);
    expect(sentences[0]).not.toHaveClass("md:hidden");
    expect(sentences[0]).toHaveTextContent(copy.day.rest.title);
  });

  it("bolds the step's name and joins it to the clause with the design's dash", () => {
    renderPage();

    const term = one("ol strong");
    expect(term).toHaveClass("text-ink");
    expect(term.parentElement).toHaveTextContent("—");
  });

  it("fails loudly for a rhythm step the message tree has no copy for", () => {
    fixture.strayStep = true;
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(renderPage).toThrow(/philosophy\.json has no copy for/u);
    errors.mockRestore();
  });
});

/* -------------------------------------------------------------------------- *
 * The badges
 * -------------------------------------------------------------------------- */

describe("PhilosophyBadges", () => {
  /** The badge row — the one list whose items are chips. */
  function row(): HTMLElement {
    return one("main#main > ul");
  }

  it("draws one badge per key of philosophy.badges, in content order", () => {
    renderPage();

    const labels = Object.values(copy.badges);
    expect([...row().children].map((node) => node.textContent)).toEqual(labels);
  });

  it("is drawn on the wide view only — the mobile reference has no badge row", () => {
    renderPage();

    expect(row()).toHaveClass("hidden", "md:flex");
  });

  it("fills the lead badge and leaves the rest white, by position not by id", () => {
    renderPage();

    const chips = row().querySelectorAll("li > span");
    expect(chips[0]).toHaveClass("bg-sage");
    for (const chip of [...chips].slice(1)) expect(chip).toHaveClass("bg-white");
  });
});

/* -------------------------------------------------------------------------- *
 * Motion and metadata
 * -------------------------------------------------------------------------- */

describe("the page's observers and metadata", () => {
  it("adds no second IntersectionObserver (INV-05.9)", () => {
    renderPage();

    const shapes = new Set(observer.constructed.map((options) => JSON.stringify(options)));
    expect(shapes.size).toBe(1);
  });

  it("publishes the canonical site.routes[] gives it, in every locale", async () => {
    const href = getSite().routes.find((route) => route.id === "philosophy")?.path ?? "";

    for (const locale of routing.locales) {
      const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });
      expect(metadata.alternates?.canonical).toBe(pathFor(locale, href));
    }
  });

  it("takes its title and description from philosophy.meta.*, never from a literal", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: EN }) });

    expect(metadata.title).toBe(copy.meta.title);
    expect(metadata.description).toBe(copy.meta.description);
  });
});
