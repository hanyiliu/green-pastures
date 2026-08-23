import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import { SECTION_IDS } from "@/components/layout/Section";
import { getSite } from "@/content/site";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { reference } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

import {
  installIntersectionObserverStub,
  type IntersectionObserverStub,
} from "../../motion/harness";

/**
 * The Visit section (04 §3.5, §4, §6; 05 §5.3; 07 §1, §6;
 * `docs/design/desktop/README.md` §8 and `docs/design/mobile/README.md` §8).
 *
 * The row's own acceptance is what this file is about, and the first item is
 * the one a green build cannot see:
 *
 * - **the hours are derived, never typed.** "Monday – Friday" and
 *   "7:30 am – 6:00 pm" are `site.hours` — five ids and two `HH:MM` strings —
 *   put through `weekdayLong`, `timeShort` and the two range templates
 *   (02 `D-02.6`). The suite recomputes them from the config with `Intl` and
 *   then proves neither string exists anywhere in `content/`;
 * - **`#visit` is the anchor the whole site aims at**: `SECTION_IDS`' last
 *   entry, `site.nav.cta.href` and the footer's `contact` entry (07 §6,
 *   INV-04.8);
 * - **the white card is the section's, not the form's** (07 `D-07.4`): the
 *   card that survives the swap to the success panel is drawn by this section
 *   and the form renders inside it;
 * - **the `NoscriptFallback` is server-rendered here and passed as a node**, so
 *   no Server Component ends up in the form's client module graph (04 §3.5);
 * - **both copy toggles render both strings** and let `md:` choose, so no view
 *   is a code branch (`D-04.5`, INV-04.4);
 * - the section's three `fade` blocks add **no second IntersectionObserver**
 *   (INV-05.9).
 *
 * Every expectation is derived from `content/` — `site.json` and the message
 * tree — rather than typed out, so the suite catches a section that stopped
 * agreeing with the content rather than one that agrees with itself.
 *
 * **Turnstile is mocked, and only Turnstile.** The real widget owns an
 * `IntersectionObserver` of its own (07 §1's lazy-load trigger), which is not
 * a `Reveal` and would make INV-05.9's count unreadable; it is exercised
 * against a hand-driven script in `tests/unit/forms/Turnstile.test.tsx`.
 * Everything else here is the real component, including the real form.
 */

vi.mock("@/components/forms/Turnstile", () => ({
  Turnstile: () => <div data-testid="turnstile" />,
}));

const { default: VisitSection } = await import("@/components/sections/visit/VisitSection");

let observer: IntersectionObserverStub;

beforeAll(() => {
  observer = installIntersectionObserverStub();
});

beforeEach(() => {
  resetRevealRegistry();
});

function renderVisit() {
  return render(
    <NextIntlClientProvider
      locale={routing.defaultLocale}
      messages={reference}
      formats={formats}
      timeZone={TIME_ZONE}
    >
      <MotionProvider>
        <VisitSection />
      </MotionProvider>
    </NextIntlClientProvider>,
  );
}

const site = getSite();
const copy = reference.home.visit;

/** Whitespace-insensitive comparison — `Intl` separates "7:30" from "AM" with U+202F. */
function normalise(value: string | null): string {
  return (value ?? "").replace(/\s+/gu, " ").trim();
}

/**
 * The two hour lines, recomputed from `content/site.json` the way the section
 * does — the `weekdayLong` / `timeShort` formats over an anchor date, dropped
 * into `common.format.dayRange` / `common.format.timeRange`.
 *
 * Deriving them here rather than writing "Monday – Friday" out is the point: an
 * owner who opens on Saturday changes the expectation and the render together,
 * and neither is a string anyone typed.
 */
const EXPECTED_HOURS = (() => {
  const named = (options: Intl.DateTimeFormatOptions, value: Date): string =>
    new Intl.DateTimeFormat(routing.defaultLocale, { timeZone: TIME_ZONE, ...options }).format(
      value,
    );

  /** A `Date` on the given weekday: 1 January 2024 was a Monday. */
  const onWeekday = (day: string): Date => {
    const order = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const index = order.indexOf(day);
    return new Date(Date.UTC(2024, 0, 1 + (index === 0 ? 6 : index - 1), 12));
  };

  /** A `Date` whose Los Angeles clock reads `HH:MM`. */
  const atClock = (time: string): Date => {
    const [hours, minutes] = time.split(":").map(Number);
    const naive = Date.UTC(2024, 0, 1, hours, minutes);
    const shown = new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(naive));
    const [shownHours, shownMinutes] = shown.split(":").map(Number);
    const offset = Date.UTC(2024, 0, 1, shownHours, shownMinutes) - naive;
    return new Date(naive - offset);
  };

  const days = site.hours.days;
  const template = (pattern: string, from: string, to: string): string =>
    pattern.replace("{from}", from).replace("{to}", to);

  return {
    days: template(
      reference.common.format.dayRange,
      named({ weekday: "long" }, onWeekday(days.at(0) ?? "mon")),
      named({ weekday: "long" }, onWeekday(days.at(-1) ?? "fri")),
    ),
    times: template(
      reference.common.format.timeRange,
      named(formats.dateTime.timeShort, atClock(site.hours.open)),
      named(formats.dateTime.timeShort, atClock(site.hours.close)),
    ),
  };
})();

/** The `<section>` this file is about. */
function section(): HTMLElement {
  const element = document.querySelector<HTMLElement>("section[data-section='visit']");
  if (element === null) throw new Error("the Visit section did not render");
  return element;
}

/** Every link pointing at `site.contact.mapsUrl`, in DOM order. */
function mapLinks(): HTMLAnchorElement[] {
  return [
    ...section().querySelectorAll<HTMLAnchorElement>(
      `a[href='${CSS.escape(site.contact.mapsUrl)}']`,
    ),
  ];
}

/* -------------------------------------------------------------------------- *
 * The anchor
 * -------------------------------------------------------------------------- */

describe("the #visit anchor (INV-04.8, 07 §6)", () => {
  it("is the last section id, and the one every Book-a-tour control targets", () => {
    expect(SECTION_IDS.at(-1)).toBe("visit");
    expect(site.nav.cta.href).toBe("/#visit");
    expect(site.nav.footer.find((item) => item.id === "contact")?.href).toBe("/#visit");
  });

  it("renders as a labelled section whose heading is the h2", () => {
    renderVisit();

    const heading = screen.getByRole("heading", { level: 2 });

    expect(section()).toHaveAttribute("id", "visit");
    expect(section()).toHaveAttribute("aria-labelledby", heading.id);
    expect(normalise(heading.textContent)).toBe(normalise(copy.title));
  });
});

/* -------------------------------------------------------------------------- *
 * The header
 * -------------------------------------------------------------------------- */

describe("the header (D L310–L313, M L222–L225)", () => {
  it("paints the title white and honours its line break only >= md", () => {
    renderVisit();

    const heading = screen.getByRole("heading", { level: 2 });

    expect(heading).toHaveClass("text-white!");
    expect(heading).toHaveClass("md:whitespace-pre-line");
    // The break is in the content, not in the markup: no <br> anywhere.
    expect(heading.querySelector("br")).toBeNull();
    expect(copy.title).toContain("\n");
  });

  it("renders both subtitles and lets md: choose (D-04.5, INV-04.4)", () => {
    renderVisit();

    const short = screen.getByText(copy.subtitleShort);
    const long = screen.getByText(copy.subtitle);

    expect(short).toHaveClass("md:hidden");
    expect(long).toHaveClass("hidden", "md:block");
  });
});

/* -------------------------------------------------------------------------- *
 * The hours
 * -------------------------------------------------------------------------- */

describe("the hours are derived from site.hours, never typed (02 D-02.6)", () => {
  it("prints the week and the clock the config declares", () => {
    renderVisit();

    const value = screen.getByText(reference.home.visit.info.hoursLabel).closest("div");
    expect(normalise(value?.textContent ?? "")).toContain(normalise(EXPECTED_HOURS.days));
    expect(normalise(value?.textContent ?? "")).toContain(normalise(EXPECTED_HOURS.times));
  });

  it("stores neither line in the content tree", () => {
    const content = `${JSON.stringify(reference)}${JSON.stringify(site)}`;

    expect(content).not.toContain(EXPECTED_HOURS.days);
    expect(content).not.toContain(EXPECTED_HOURS.times);
  });

  it("joins the two halves on one line < md and stacks them >= md (04 §6)", () => {
    renderVisit();

    const times = screen.getByText(EXPECTED_HOURS.times);
    const separator = section().querySelector("[aria-hidden='true'].md\\:hidden");

    expect(times).toHaveClass("md:block");
    expect(times).toHaveClass("lowercase");
    expect(normalise(separator?.textContent ?? "")).toBe("·");
  });
});

/* -------------------------------------------------------------------------- *
 * The info panel
 * -------------------------------------------------------------------------- */

describe("the info panel (04 §3.5)", () => {
  it("is a description list of three terms, all from the content tree", () => {
    renderVisit();

    const list = section().querySelector("dl");
    const terms = [...(list?.querySelectorAll("dt") ?? [])].map((term) =>
      normalise(term.textContent),
    );

    expect(list).not.toBeNull();
    expect(terms).toEqual([copy.info.visitLabel, copy.info.hoursLabel, copy.info.languagesLabel]);
    expect(screen.getByText(copy.info.city)).toBeInTheDocument();
    expect(screen.getByText(copy.info.languages)).toBeInTheDocument();
  });

  it("upper-cases its labels through the Eyebrow recipe only (04 §5.5)", () => {
    renderVisit();

    const label = screen.getByText(copy.info.visitLabel);

    expect(label).toHaveClass("uppercase", "text-panel-label");
    // The words reach the DOM in the case the content tree authored them.
    expect(label.textContent).toBe(copy.info.visitLabel);
  });
});

/* -------------------------------------------------------------------------- *
 * The map
 * -------------------------------------------------------------------------- */

describe("the map (07 §6)", () => {
  it("is a photo slot in a new-tab link, never an embed", () => {
    renderVisit();

    expect(section().querySelector("iframe")).toBeNull();

    const [photoLink] = mapLinks();
    const slot = photoLink?.querySelector("[data-photo-slot='map']");

    expect(slot).toHaveAttribute("aria-label", copy.map.alt);
    expect(photoLink).toHaveAttribute("target", "_blank");
    expect(photoLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("also offers the destination as words, with the new-tab warning (02)", () => {
    renderVisit();

    const textLink = mapLinks().find((link) =>
      normalise(link.textContent).startsWith(copy.info.mapsLink),
    );

    expect(mapLinks()).toHaveLength(2);
    expect(normalise(textLink?.textContent ?? "")).toBe(
      `${copy.info.mapsLink} ${reference.common.links.newTab}`,
    );
    expect(textLink).toHaveAttribute("rel", "noopener noreferrer");
  });
});

/* -------------------------------------------------------------------------- *
 * The form and its card
 * -------------------------------------------------------------------------- */

describe("the inquiry form (07 §1, D-07.4)", () => {
  it("renders inside the section's own white card", () => {
    renderVisit();

    const card = section().querySelector<HTMLElement>("[data-reveal-id='visit.form']");

    expect(card).toHaveClass("bg-white", "rounded-card-md", "md:rounded-card");
    expect(card?.querySelector("form")).not.toBeNull();
  });

  it("is the home placement, in the page's locale", () => {
    renderVisit();

    const form = section().querySelector("form");

    expect(form?.querySelector("input[name='source']")).toHaveValue("home");
    expect(form?.querySelector("input[name='locale']")).toHaveValue(routing.defaultLocale);
    expect(form).toHaveAttribute("lang", routing.defaultLocale);
    expect(screen.getByRole("button", { name: reference.visit.form.submit })).toBeInTheDocument();
  });

  /**
   * A browser with scripting *enabled* parses `<noscript>` content as raw text,
   * so `NoscriptFallback` writes markup rather than JSX children and the
   * assertion reads `innerHTML`. There are two `<noscript>`s in the card — the
   * form's own submit-hiding stylesheet and this one — and the fallback is
   * the one carrying the copy.
   */
  it("server-renders the noscript fallback rather than letting the form import it", () => {
    renderVisit();

    const markup = [...section().querySelectorAll("noscript")]
      .map((element) => element.innerHTML)
      .join("");

    expect(markup).toContain(reference.visit.form.noscript);
    expect(markup).toContain(`mailto:${site.contact.email}`);
    expect(markup).toContain(`tel:${site.contact.phone}`);
    expect(markup).toContain(site.contact.phoneDisplay);
  });
});

/* -------------------------------------------------------------------------- *
 * Motion
 * -------------------------------------------------------------------------- */

describe("the three fade blocks (05 §5.3)", () => {
  it("reveals the header, the card and the info column, and nothing else", () => {
    renderVisit();

    const ids = [...section().querySelectorAll("[data-reveal-id]")].map(
      (element) => element.getAttribute("data-reveal-id") ?? "",
    );

    expect(ids).toEqual(["visit.header", "visit.form", "visit.info"]);
  });

  it("adds no second IntersectionObserver (INV-05.9)", () => {
    renderVisit();

    expect(observer.constructed).toHaveLength(1);
  });
});
