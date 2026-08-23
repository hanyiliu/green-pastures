import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import { HeroSection } from "@/components/sections/hero/HeroSection";
import { getSite } from "@/content/site";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { loadMessages, reference } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";

import {
  installIntersectionObserverStub,
  type IntersectionObserverStub,
} from "../../motion/harness";

/**
 * The hero (04 §3.5, §4, §7; 05 §5.3; `docs/design/desktop/README.md` §1 and
 * `docs/design/mobile/README.md` §1).
 *
 * The first section that renders a design rather than a stub, so the checks
 * here are the ones a green build cannot make on its own. Four of them are the
 * row's own acceptance:
 *
 * - the **LCP element is never at opacity 0** — the photo block rises on
 *   transform alone while the text column fades (OQ-05.8, INV-05.7). That is
 *   observable in the DOM as an inline style, and it is the one thing about
 *   this section that would be silently wrong forever;
 * - the section adds **no second IntersectionObserver** (INV-05.9);
 * - **both `*Short` toggles render both strings** and let `md:` choose, so no
 *   view is a code branch (`D-04.5`, INV-04.4);
 * - **every locale renders its own copy**, iterated from `routing.locales` so a
 *   fourth locale needs no edit here (04 §8).
 *
 * Every expectation is derived from `content/` — the message tree, `site.json`
 * — rather than typed out, which is what makes the suite catch a link that
 * stopped resolving instead of agreeing with itself.
 */

const nav = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("@/i18n/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/navigation")>();
  return { ...actual, usePathname: () => nav.pathname };
});

let observer: IntersectionObserverStub;

beforeAll(() => {
  observer = installIntersectionObserverStub();
});

beforeEach(() => {
  nav.pathname = "/";
  resetRevealRegistry();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

type Tree = typeof reference;

function renderHero(locale: Locale = routing.defaultLocale, messages: Tree = reference) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      formats={formats}
      timeZone={TIME_ZONE}
    >
      <MotionProvider>
        <HeroSection />
      </MotionProvider>
    </NextIntlClientProvider>,
  );
}

const hero = reference.home.hero;

/** The message tree production would assemble for a locale (02 `D-02.8`). */
async function productionTree(locale: Locale): Promise<Tree> {
  vi.stubEnv("NODE_ENV", "production");
  const tree = await loadMessages(locale);
  vi.unstubAllEnvs();
  return tree;
}

function reveal(id: string): HTMLElement {
  const element = document.querySelector(`[data-reveal-id="${id}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`no reveal with id ${id}`);
  return element;
}

function deco(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`no decoration with id ${id}`);
  return element;
}

/** The plain text of a title message — the rich `<em>` stripped, the `\n` kept. */
function plainTitle(title: string): string {
  return title.replace(/<\/?em>/gu, "");
}

/* -------------------------------------------------------------------------- *
 * Landmarks and headings (INV-04.8, 04 §7)
 * -------------------------------------------------------------------------- */

describe("the section shell", () => {
  it("is the `hero` section, labelled by the one h1 on the page", () => {
    const { container } = renderHero();

    const section = container.querySelector("section");
    expect(section).toHaveAttribute("id", "hero");
    expect(section).toHaveAttribute("data-section", "hero");

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(section).toHaveAttribute("aria-labelledby", headings[0]?.id);
  });

  it("takes the hero's own padding rather than the shared section box (03 §4)", () => {
    const { container } = renderHero();

    // 36/22/40 below `md`, 60/44/56 above — every class important, because each
    // replaces a property the `Section` recipe sets.
    expect(container.querySelector("section")?.className).toContain("pt-9!");
    expect(container.querySelector("section")?.className).toContain("md:pb-14!");
  });
});

/* -------------------------------------------------------------------------- *
 * Copy (INV-02.1, INV-04.4, D-04.5)
 * -------------------------------------------------------------------------- */

describe("the copy is the content tree's", () => {
  it("renders the badge, the headline and the scroll cue from `home.hero`", () => {
    renderHero();

    expect(screen.getByText(hero.badge)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      plainTitle(hero.title).replace("\n", " "),
    );
    expect(screen.getByText(hero.scrollCue)).toBeInTheDocument();
  });

  it("draws the accent word in sage — the hero has no --section-accent (03 §2.3)", () => {
    renderHero();

    const accent = /<em>(?<word>[^<]+)<\/em>/u.exec(hero.title)?.groups?.word;
    const element = screen.getByText(accent ?? "");
    expect(element.tagName).toBe("EM");
    expect(element).toHaveClass("text-sage", "not-italic");
  });

  it("honours the title's line break `>= md` only (02 §Line breaks, 04 §6)", () => {
    renderHero();

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).toContain("md:whitespace-pre-line");
    expect(heading.className).not.toMatch(/(^|\s)whitespace-pre-line/u);
  });

  it("renders both halves of every *Short pair and lets `md:` choose (D-04.5)", () => {
    renderHero();

    for (const [short, long] of [
      [hero.subtitleShort, hero.subtitle],
      [hero.trust.agesShort, hero.trust.ages],
      [hero.mealsCard.subtitleShort, hero.mealsCard.subtitle],
    ] as const) {
      expect(screen.getByText(short).className).toContain("md:hidden");
      expect(screen.getByText(long).className).toMatch(/\bhidden\b/u);
      expect(screen.getByText(long).className).toMatch(/\bmd:(block|inline)\b/u);
    }
  });

  it("prints the Yelp rating through the shared config and the `rating` format", () => {
    renderHero();

    const rating = getSite().yelp?.rating;
    expect(rating).toBeDefined();
    const formatted = new Intl.NumberFormat(routing.defaultLocale, formats.number.rating).format(
      rating ?? 0,
    );

    expect(
      screen.getByText(hero.trust.yelp.replace("{rating, number, rating}", formatted)),
    ).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- *
 * The trust row's accessible name (04 §3.2, §3.5; 03 §10)
 * -------------------------------------------------------------------------- */

describe("the trust row", () => {
  it("hides the star glyphs and names the group with common.rating.ariaLabel", () => {
    const { container } = renderHero();

    const rating = getSite().yelp?.rating ?? 0;
    const formatted = new Intl.NumberFormat(routing.defaultLocale, formats.number.rating).format(
      rating,
    );
    const expected = reference.common.rating.ariaLabel.replace(
      "{rating, number, rating}",
      formatted,
    );

    const group = screen.getByRole("img", { name: expected });
    expect(group).toBeInTheDocument();

    const stars = container.querySelectorAll('[aria-hidden="true"] > span');
    expect([...stars].filter((star) => star.textContent === "★")).toHaveLength(5);
  });
});

/* -------------------------------------------------------------------------- *
 * Links (04 §3.5, 06 D-06.7)
 * -------------------------------------------------------------------------- */

describe("both CTAs and the cue point into this page", () => {
  it("sends the primary CTA to site.nav.cta.href's anchor", () => {
    renderHero();

    const anchor = getSite().nav.cta.href.replace(/^\//u, "");
    expect(screen.getByRole("link", { name: hero.ctaPrimary })).toHaveAttribute("href", anchor);
  });

  it("sends the secondary CTA and the scroll cue to the philosophy home anchor", () => {
    renderHero();

    const route = getSite().routes.find((entry) => entry.id === "philosophy");
    const href = `#${route?.homeAnchor ?? ""}`;

    expect(screen.getByRole("link", { name: hero.ctaSecondary })).toHaveAttribute("href", href);
    expect(screen.getByRole("link", { name: hero.scrollCue })).toHaveAttribute("href", href);
  });

  it("keeps the secondary CTA a hash link, not the philosophy subpage", () => {
    renderHero();

    const route = getSite().routes.find((entry) => entry.id === "philosophy");
    expect(screen.getByRole("link", { name: hero.ctaSecondary }).getAttribute("href")).not.toBe(
      route?.path,
    );
  });
});

/* -------------------------------------------------------------------------- *
 * Motion (05 §5.3, §5.9; OQ-05.8)
 * -------------------------------------------------------------------------- */

describe("the two reveals", () => {
  it("rises the text column with its opacity track", () => {
    renderHero();

    const text = reveal("hero.text");
    expect(text.style.opacity).toBe("0");
    expect(text.style.transform).toContain("translateY(26px)");
  });

  it("rises the photo block on transform alone — the LCP element is never at opacity 0", () => {
    renderHero();

    const photo = reveal("hero.photo");
    expect(photo.style.transform).toContain("translateY(26px)");
    expect(photo.style.opacity).toBe("");
  });

  it("gives the scroll cue a `none` reveal, so it joins the cascade without an entrance", () => {
    renderHero();

    const cue = reveal("hero.cue");
    expect(cue.style.opacity).toBe("");
    expect(cue.style.transform).toBe("");
  });

  it("observes the two entrances and nothing else (INV-05.9)", () => {
    renderHero();

    expect(observer.observedCount()).toBe(2);
    const options = observer.constructed.map((entry) => JSON.stringify(entry));
    expect(new Set(options).size).toBeLessThanOrEqual(1);
  });
});

/* -------------------------------------------------------------------------- *
 * Decorations (04 §3.4, INV-04.5, INV-05.5)
 * -------------------------------------------------------------------------- */

describe("the decoration layer", () => {
  it("renders the sun, three leaves and the cue with `deco-*` ids repeated as data-deco", () => {
    renderHero();

    for (const id of [
      "deco-hero-sun",
      "deco-hero-leaf-1",
      "deco-hero-leaf-2",
      "deco-hero-leaf-3",
      "deco-hero-cue",
    ]) {
      expect(deco(id)).toHaveAttribute("data-deco", id);
    }
  });

  it("loops all five hero decorations — the only looping set in the design", () => {
    renderHero();

    for (const id of [
      "deco-hero-sun",
      "deco-hero-leaf-1",
      "deco-hero-leaf-2",
      "deco-hero-leaf-3",
      "deco-hero-cue",
    ]) {
      expect(deco(id).firstElementChild).toHaveClass("loop");
    }
  });

  it("draws one leaf below `md` and three above (04 §3.4)", () => {
    renderHero();

    expect(deco("deco-hero-leaf-1").className).not.toMatch(/\bhidden\b/u);
    for (const id of ["deco-hero-leaf-2", "deco-hero-leaf-3"]) {
      expect(deco(id).className).toContain("hidden");
      expect(deco(id).className).toContain("md:block");
    }
  });

  it("keeps the sun and the leaves out of the reading order", () => {
    renderHero();

    for (const id of ["deco-hero-sun", "deco-hero-leaf-1"]) {
      expect(deco(id)).toHaveAttribute("aria-hidden", "true");
    }
  });
});

/* -------------------------------------------------------------------------- *
 * The photo (INV-04.6, D-04.12)
 * -------------------------------------------------------------------------- */

describe("the photo", () => {
  it("reserves the box as a PhotoSlot, carrying the future photo's alt", () => {
    const { container } = renderHero();

    const slot = container.querySelector('[data-photo-slot="hero"]');
    expect(slot).toHaveAttribute("role", "img");
    expect(slot).toHaveAttribute("aria-label", hero.photo.alt);
    expect(slot?.className).toContain("rounded-hero!");
  });
});

/* -------------------------------------------------------------------------- *
 * Every locale (04 §8)
 * -------------------------------------------------------------------------- */

describe("every id in routing.locales", () => {
  it.each(routing.locales)("renders %s's own headline, not a marker", async (locale) => {
    const messages = await productionTree(locale);
    renderHero(locale, messages);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(plainTitle(messages.home.hero.title).replace("\n", " "));
    expect(heading.textContent).not.toContain("⟦");
  });

  it("renders a different headline in each locale — no tree is falling back to another", async () => {
    const titles: string[] = [];

    for (const locale of routing.locales) {
      const messages = await productionTree(locale);
      const { unmount } = renderHero(locale, messages);
      titles.push(screen.getByRole("heading", { level: 1 }).textContent ?? "");
      unmount();
      resetRevealRegistry();
    }

    expect(new Set(titles).size).toBe(routing.locales.length);
  });
});
