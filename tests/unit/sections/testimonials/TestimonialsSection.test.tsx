import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { Reveal } from "@/components/motion/Reveal";
import { resetRevealRegistry } from "@/components/motion/registry";
import { ReviewsHeader } from "@/components/sections/testimonials/ReviewsHeader";
import { renderRichText } from "@/components/sections/testimonials/SpeechBubble";
import TestimonialsSection from "@/components/sections/testimonials/TestimonialsSection";
import type { TestimonialEntry } from "@/content/collections";
import { getSite } from "@/content/site";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { loadMessages, reference } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";

import {
  installIntersectionObserverStub,
  type IntersectionObserverStub,
} from "../../motion/harness";

/**
 * The testimonials section (04 §3.5, §6, §7; 05 §5.2, §5.3; the `06
 * TESTIMONIALS` block of both design references).
 *
 * The checks here are the ones a green build cannot make on its own, and the
 * row's own acceptance is four of them:
 *
 * - **both count-ups read `site.yelp`** and both put their *final* value in the
 *   server HTML — asserted through `renderToStaticMarkup`, which is the only
 *   render that proves INV-05.10 rather than assuming it;
 * - **`countLine` is a real plural per locale** — the singular and the plural
 *   branch are both driven, which is what the argument rename made possible;
 * - **the stars are `aria-hidden` and the rating is text**, named once and in
 *   full by `common.rating.ariaLabel`;
 * - **the tails alternate and the `bubble` origin follows them** (05 §5.2),
 *   with the surface flags rendering as classes rather than as branches.
 *
 * Every expectation is derived from `content/` — the message tree, `site.json`,
 * the collection — rather than typed out, so the suite catches a link that
 * stopped resolving instead of agreeing with itself.
 *
 * The two server-only doors are stubbed: `getTestimonials` is `collections.ts`,
 * which refuses to load in a browser environment (02 `D-02.16`), and
 * `getLocale` is `next-intl/server`, which has no request to read outside a
 * Next render. Both hand back exactly what production would.
 */

/* -------------------------------------------------------------------------- *
 * Doubles
 * -------------------------------------------------------------------------- */

const server = vi.hoisted(() => ({ locale: "en" }));
const collections = vi.hoisted(() => ({ entries: [] as unknown[] }));

vi.mock("next-intl/server", () => ({
  getLocale: () => Promise.resolve(server.locale),
}));

vi.mock("@/content/collections", () => ({
  getTestimonials: () => Promise.resolve(collections.entries),
}));

type Tree = typeof reference;

/** The `en` collection, joined with `site.json` exactly as `collections.ts` does. */
function joinTestimonials(): TestimonialEntry[] {
  const text = reference.collections.testimonials as Record<
    string,
    { quote: string; author: string; relation: string }
  >;
  return getSite().testimonials.map((entry) => {
    const value = text[entry.id];
    if (value === undefined) throw new Error(`no en text for testimonial "${entry.id}"`);
    return { ...entry, text: value };
  });
}

let observer: IntersectionObserverStub;

beforeAll(() => {
  observer = installIntersectionObserverStub();
});

beforeEach(() => {
  server.locale = routing.defaultLocale;
  collections.entries = joinTestimonials();
  resetRevealRegistry();
});

/* -------------------------------------------------------------------------- *
 * Rendering
 * -------------------------------------------------------------------------- */

function wrap(children: ReactNode, locale: Locale, messages: Tree): ReactElement {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      formats={formats}
      timeZone={TIME_ZONE}
    >
      <MotionProvider>{children}</MotionProvider>
    </NextIntlClientProvider>
  );
}

async function renderSection(locale: Locale = routing.defaultLocale, messages: Tree = reference) {
  server.locale = locale;
  const section = await TestimonialsSection();
  return render(wrap(section, locale, messages));
}

/**
 * The markup the server actually sends. This is the only render in which a
 * `CountUp` is un-hydrated, which is exactly why the count-up's guarantee is
 * asserted here and nowhere else: in jsdom the component has mounted, so it
 * sits at 0 waiting for an entrance that never arrives.
 */
async function staticMarkup(locale: Locale = routing.defaultLocale, messages: Tree = reference) {
  server.locale = locale;
  const section = await TestimonialsSection();
  return renderToStaticMarkup(wrap(section, locale, messages));
}

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

function bubble(id: string): HTMLElement {
  const figure = document.querySelector(`[data-testimonial="${id}"]`);
  if (!(figure instanceof HTMLElement)) throw new Error(`no bubble for ${id}`);
  const card = figure.parentElement;
  if (!(card instanceof HTMLElement)) throw new Error(`bubble ${id} has no card`);
  return card;
}

const copy = reference.home.testimonials;
const site = getSite();
const yelp = site.yelp;

if (yelp === undefined) throw new Error("content/site.json has no yelp block");

const format = (value: number, decimals: number, locale: Locale = routing.defaultLocale) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

/* -------------------------------------------------------------------------- *
 * Landmarks and headings (INV-04.8, 04 §7)
 * -------------------------------------------------------------------------- */

describe("the section shell", () => {
  it("is the `testimonials` section, labelled by its one h2", async () => {
    const { container } = await renderSection();

    const section = container.querySelector("section");
    expect(section).toHaveAttribute("id", "testimonials");
    expect(section).toHaveAttribute("data-section", "testimonials");

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings).toHaveLength(1);
    expect(section).toHaveAttribute("aria-labelledby", headings[0]?.id);
    expect(headings[0]).toHaveTextContent(copy.title);
  });

  it("takes the shared section box — this section overrides no padding (03 §4)", async () => {
    const { container } = await renderSection();

    const className = container.querySelector("section")?.className ?? "";
    expect(className).toContain("px-(--section-px)");
    expect(className).toContain("py-(--section-py)");
    expect(className).not.toMatch(/!/u);
  });
});

/* -------------------------------------------------------------------------- *
 * The header (04 §3.5, §3.3; 03 §10)
 * -------------------------------------------------------------------------- */

describe("the rating row", () => {
  it("names the stars-and-rating group once and in full, and hides the glyphs", async () => {
    const { container } = await renderSection();

    const expected = reference.common.rating.ariaLabel.replace(
      "{rating, number, rating}",
      new Intl.NumberFormat(routing.defaultLocale, formats.number.rating).format(yelp.rating),
    );

    const group = screen.getByRole("img", { name: expected });
    expect(group).toBeInTheDocument();

    // One row in the header and one per bubble, five glyphs each — every one of
    // them decorative (03 §10).
    const rows = 1 + site.testimonials.filter((entry) => entry.onHome).length;
    const stars = container.querySelectorAll('[aria-hidden="true"] > span');
    expect([...stars].filter((star) => star.textContent === "★")).toHaveLength(rows * 5);
  });

  it("draws the header row and the bubbles at their two different sizes", async () => {
    const { container } = await renderSection();

    // `StarRow size="header"` — 18/24px against the drawing's 17/24 (M L165,
    // D L238); `size="bubble"` — 14/16 against 13/15 (M L174, D L247). Both are
    // one Tailwind step above the reference and `StarRow`'s own file says why.
    const header = container.querySelector('[role="img"] > [aria-hidden="true"]');
    expect(header).toHaveClass("text-lg", "md:text-2xl");

    const bubble = container.querySelector('[data-testimonial] > [aria-hidden="true"]');
    expect(bubble).toHaveClass("text-sm", "md:text-base");
  });

  it("keeps the Yelp badge outside the group, as a word of its own", async () => {
    await renderSection();

    const badge = screen.getByText(reference.common.brand.yelp);
    expect(badge.closest('[role="img"]')).toBeNull();
    expect(badge.className).toContain("bg-yelp!");
    expect(badge.className).toContain("p-(--chip-yelp)!");
  });
});

describe("the two count-ups", () => {
  it("puts the final value in the server HTML — a crawler sees 5.0 and 47 (INV-05.10)", async () => {
    const html = await staticMarkup();

    expect(html).toContain(`>${format(yelp.rating, 1)}<`);
    expect(html).toContain(`>${format(yelp.reviewCount, 0)}<`);
    // Neither count-up ever ships a zero to a reader without JavaScript.
    expect(html).not.toContain(">0<");
    expect(html).not.toContain(">0.0<");
  });

  it("reserves each box from the final string, so arriving digits cannot shift it", async () => {
    const { container } = await renderSection();

    const widths = [...container.querySelectorAll("[data-countup]")].map((node) =>
      node instanceof HTMLElement ? node.style.minWidth : "",
    );
    expect(widths).toEqual([
      `${String(format(yelp.rating, 1).length)}ch`,
      `${String(format(yelp.reviewCount, 0).length)}ch`,
    ]);
  });

  it("adds no observer of its own — the count hears the entrance through context", async () => {
    await renderSection();

    // Three `Reveal`s, three observed elements; the two `CountUp`s and the
    // three `RevealItem`s observe nothing (05 §5.1, INV-05.9).
    expect(observer.observedCount()).toBe(3);
    const options = observer.constructed.map((entry) => JSON.stringify(entry));
    expect(new Set(options).size).toBeLessThanOrEqual(1);
  });
});

describe("the count line", () => {
  it("is aria-live=off and paints --color-sub-testimonials-count", async () => {
    await renderSection();

    const line = screen.getByText(/Fremont parents/u);
    expect(line).toHaveAttribute("aria-live", "off");
    expect(line.className).toContain("text-sub-testimonials-count");
  });

  /**
   * The message names the count-up's tag `<count>` and the plural's argument
   * `reviews`. They used to be one name, which ICU cannot resolve as both a
   * function and a number — so this is the assertion that the split works and
   * the line is a plural rather than a frozen `other`.
   */
  it("selects a real ICU plural branch per count", () => {
    const plural = (reviewCount: number) =>
      renderToStaticMarkup(
        wrap(
          <Reveal id="testimonials.header" variant="rise">
            <ReviewsHeader titleId="t" rating={yelp.rating} reviewCount={reviewCount} />
          </Reveal>,
          routing.defaultLocale,
          reference,
        ),
      ).replace(/<[^>]*>/gu, "");

    expect(plural(1)).toContain("1 review ·");
    expect(plural(47)).toContain("47 reviews ·");
    expect(plural(1)).not.toContain("reviews");
  });
});

/* -------------------------------------------------------------------------- *
 * The bubbles (04 §3.5, §6; 02 D-02.13; 05 §5.2)
 * -------------------------------------------------------------------------- */

describe("the bubble list", () => {
  it("renders every `onHome` review as an <li> inside one <ul>", async () => {
    const { container } = await renderSection();

    const onHome = site.testimonials.filter((entry) => entry.onHome);
    const list = container.querySelector("ul");
    expect(list?.className).toContain("lg:grid-cols-3");
    expect(list?.querySelectorAll(":scope > li")).toHaveLength(onHome.length);

    const offHome = site.testimonials.filter((entry) => !entry.onHome);
    expect(offHome.length).toBeGreaterThan(0);
    for (const entry of offHome) {
      expect(document.querySelector(`[data-testimonial="${entry.id}"]`)).toBeNull();
    }
  });

  it("alternates the tail by DOM position on both views", async () => {
    await renderSection();

    const onHome = site.testimonials.filter((entry) => entry.onHome);
    onHome.forEach((entry, index) => {
      const expected = index % 2 === 0 ? "rounded-bubble-l" : "rounded-bubble-r";
      expect(bubble(entry.id).className).toContain(expected);
    });
  });

  it("gives the `bubble` entrance the origin its tail names (05 §5.2)", async () => {
    await renderSection();

    const onHome = site.testimonials.filter((entry) => entry.onHome);
    onHome.forEach((entry, index) => {
      const expected = index % 2 === 0 ? "12% 100%" : "88% 100%";
      expect(bubble(entry.id).style.transformOrigin).toBe(expected);
    });
  });

  it("starts every bubble scaled down and transparent, from the tail", async () => {
    await renderSection();

    const first = bubble(site.testimonials[0]?.id ?? "");
    expect(first.style.opacity).toBe("0");
    expect(first.style.transform).toContain("scale(0.3)");
  });

  it("pushes the centre column 30px and only at `lg` (D L253)", async () => {
    await renderSection();

    const onHome = site.testimonials.filter((entry) => entry.onHome);
    onHome.forEach((entry, index) => {
      const className = bubble(entry.id).className;
      expect(className.includes("lg:mt-7.5")).toBe(index === 1);
    });
  });

  it("renders `onMobile: false` as a class toggle, never as a missing card", async () => {
    await renderSection();

    const onHome = site.testimonials.filter((item) => item.onHome);
    const drawn = onHome.map((entry) => {
      const className = bubble(entry.id).className;
      return {
        id: entry.id,
        narrow: !className.includes("hidden"),
        wide: className.includes("flex"),
      };
    });

    // Every card is in the DOM on both views; only `display` differs.
    expect(drawn).toEqual(
      onHome.map((entry) => ({ id: entry.id, narrow: entry.onMobile, wide: true })),
    );

    // The design draws three bubbles wide and two narrow (D L244, M L172).
    expect(onHome.filter((entry) => !entry.onMobile)).toHaveLength(1);
  });
});

describe("one review", () => {
  it("is a figure whose quote carries the locale's own quotation marks", async () => {
    await renderSection();

    const entry = joinTestimonials()[0];
    if (entry === undefined) throw new Error("no testimonials");

    const quote = bubble(entry.id).querySelector("blockquote");
    const marks = reference.common.punctuation;
    expect(quote?.textContent?.startsWith(marks.quoteOpen)).toBe(true);
    expect(quote?.textContent?.endsWith(marks.quoteClose)).toBe(true);
    expect(quote?.textContent).toContain(entry.text.quote.replace(/<\/?em>/gu, ""));
  });

  it("renders the quote's <em> as an element, not as text", async () => {
    await renderSection();

    const accent = /<em>(?<word>[^<]+)<\/em>/u.exec(reference.collections.testimonials.meiL.quote)
      ?.groups?.word;
    expect(accent).toBeDefined();

    const element = screen.getByText(accent ?? "");
    expect(element.tagName).toBe("EM");
    expect(document.body.innerHTML).not.toContain("&lt;em&gt;");
  });

  it("names the reviewer and paints the relation with the token 03 minted for it", async () => {
    await renderSection();

    const entry = joinTestimonials()[0];
    if (entry === undefined) throw new Error("no testimonials");

    const caption = bubble(entry.id).querySelector("figcaption");
    expect(caption).toHaveTextContent(entry.text.author);
    expect(screen.getByText(entry.text.relation).className).toContain(
      "text-sub-testimonials-attribution",
    );
  });

  it("reserves the avatar as a decorative circular PhotoSlot", async () => {
    await renderSection();

    const entry = joinTestimonials()[0];
    if (entry === undefined) throw new Error("no testimonials");

    const slot = document.querySelector(`[data-photo-slot="${entry.id}"]`);
    expect(slot).toHaveAttribute("aria-hidden", "true");
    expect(slot?.className).toContain("rounded-full");

    // Both sizes carry the important modifier: without it on the `md:` twin,
    // `!important` on the base class wins inside the media query too and the
    // desktop avatar silently stays at 38px.
    expect(slot?.className).toContain("size-9.5!");
    expect(slot?.className).toContain("md:size-11!");
  });

  it("refuses a rich tag it cannot resolve rather than printing brackets", () => {
    expect(() => renderRichText("read <link>the policy</link>", "test")).toThrow(/richTags/u);
    expect(renderRichText("plain words", "test")).toEqual(["plain words"]);
  });

  it("renders both presentational tags of 02 D-02.5, and only those", () => {
    const html = renderToStaticMarkup(
      <p>{renderRichText("a <em>b</em> and <strong>c</strong>", "test")}</p>,
    );
    expect(html).toBe("<p>a <em>b</em> and <strong>c</strong></p>");
  });
});

/* -------------------------------------------------------------------------- *
 * The outbound link (04 §3.5, 07 §4)
 * -------------------------------------------------------------------------- */

describe("the Yelp link", () => {
  it("opens site.yelp.url in a new tab and says so in its accessible name", async () => {
    await renderSection();

    const link = screen.getByRole("link", {
      name: `${copy.link} ${reference.common.links.newTab}`,
    });
    expect(link).toHaveAttribute("href", yelp.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    // The warning is visually hidden, not merely small.
    expect(screen.getByText(reference.common.links.newTab).className).toContain("sr-only");
  });

  it("keeps the 44px target on the anchor and the rule on the words (INV-04.7)", async () => {
    await renderSection();

    const link = screen.getByRole("link");
    expect(link.className).toContain("min-h-(--tap-min)");
    expect(link.className).toContain("text-blurb");
    expect(screen.getByText(copy.link).className).toContain(
      "border-(color:--section-link-underline)",
    );
  });
});

/* -------------------------------------------------------------------------- *
 * Motion (05 §5.3)
 * -------------------------------------------------------------------------- */

describe("the three reveals", () => {
  it("rises the header and the link row and staggers the bubbles", async () => {
    await renderSection();

    expect(reveal("testimonials.header").style.transform).toContain("translateY(26px)");
    expect(reveal("testimonials.link").style.transform).toContain("translateY(26px)");

    // A stagger container is never itself transformed (INV-05.4).
    const list = reveal("testimonials.bubbles");
    expect(list.tagName).toBe("UL");
    expect(list.style.transform).toBe("");
    expect(list.style.opacity).toBe("");
  });
});

/* -------------------------------------------------------------------------- *
 * Every locale (04 §8)
 * -------------------------------------------------------------------------- */

describe("every id in routing.locales", () => {
  it.each(routing.locales)("renders %s's own title and count line", async (locale) => {
    const messages = await productionTree(locale);
    const html = await staticMarkup(locale, messages);
    const text = html.replace(/<[^>]*>/gu, "");

    expect(text).toContain(messages.home.testimonials.title);
    expect(text).toContain(format(yelp.reviewCount, 0, locale));
    expect(text).not.toContain("⟦");
  });

  it("renders a different title and count line in each locale — no tree is falling back", async () => {
    const titles = new Set<string>();
    const lines = new Set<string>();

    for (const locale of routing.locales) {
      const messages = await productionTree(locale);
      const { unmount } = await renderSection(locale, messages);
      titles.add(screen.getByRole("heading", { level: 2 }).textContent ?? "");
      lines.add(document.querySelector('[aria-live="off"]')?.textContent ?? "");
      unmount();
      resetRevealRegistry();
    }

    expect(titles.size).toBe(routing.locales.length);
    expect(lines.size).toBe(routing.locales.length);
  });
});
