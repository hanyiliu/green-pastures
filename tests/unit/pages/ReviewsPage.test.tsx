import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import ReviewsPage, { generateMetadata } from "@/app/[locale]/reviews/page";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import type { TestimonialEntry } from "@/content/collections";
import { getSite } from "@/content/site";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { loadMessages, reference } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";

import { installIntersectionObserverStub, installMatchMedia } from "../motion/harness";
import { intlFixture } from "../seo/intl-server";

/**
 * The reviews page (PR-6.6; 04 §3.6, §6; 06 `D-06.1`, `D-06.10`; D L511–546,
 * M L411–439).
 *
 * The row's acceptance is three things, and each is a claim a green build
 * cannot make:
 *
 * - **`alanW` is subpage-only.** He is `onHome: false`, so the home section
 *   drops him and this page must not: the flag exists to *add* a review here.
 * - **`countLine` is a real plural.** The key carried a shape ICU cannot
 *   resolve until this row fixed it — one argument was asked to be a rich-tag
 *   function and a number at once — so both plural branches are driven here,
 *   and the tag is asserted to have rendered rather than to have fallen back to
 *   the key.
 * - **The Yelp button leaves the site, and says so.** `target="_blank"` with
 *   `rel`, and the new-tab hint inside the accessible name.
 *
 * Everything is derived from `content/site.json` and the message tree, so a
 * renamed reviewer or a changed count fails the suite rather than passing
 * against a stale copy.
 */

/* -------------------------------------------------------------------------- *
 * Doubles
 * -------------------------------------------------------------------------- */

/** See `GalleryPage.test.tsx` — `ViewTransition` is not in the published react. */
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    ViewTransition: ({ children }: { children?: ReactNode }) =>
      actual.createElement("div", { "data-testid": "view-transition" }, children),
  };
});

/**
 * The `next-intl/server` seam. PR-6.8 already built it for the metadata suites
 * and the sibling subpage rows already render through it, so this reuses that
 * one rather than adding a second: it is next-intl's own `createTranslator`
 * over the real `content/` tree, merged over `en` exactly as production merges
 * it (02 `D-02.8`), so the strings asserted here are the strings that ship.
 */
vi.mock("next-intl/server", async () => {
  const { createIntlServerStub } = await import("../seo/intl-server");
  return createIntlServerStub();
});

const collection = vi.hoisted(() => ({ entries: [] as unknown[] }));

vi.mock("@/content/collections", () => ({
  getTestimonials: () => Promise.resolve(collection.entries),
}));

type Tree = typeof reference;

/** The `en` collection joined with `site.json`, exactly as `collections.ts` does. */
function joinTestimonials(): TestimonialEntry[] {
  const text = reference.collections.testimonials;
  return getSite().testimonials.map((entry) => {
    const value = text[entry.id as keyof typeof text];
    if (value === undefined) throw new Error(`no en text for testimonial "${entry.id}"`);
    return { ...entry, text: value };
  });
}

beforeAll(() => {
  installIntersectionObserverStub();
  installMatchMedia(true);
});

beforeEach(() => {
  intlFixture.locale = routing.defaultLocale;
  collection.entries = joinTestimonials();
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

async function renderPage(locale: Locale = routing.defaultLocale, messages: Tree = reference) {
  intlFixture.locale = locale;
  const page = await ReviewsPage();
  return render(wrap(page, locale, messages));
}

/** The message tree production would assemble for a locale (02 `D-02.8`). */
async function productionTree(locale: Locale): Promise<Tree> {
  vi.stubEnv("NODE_ENV", "production");
  const tree = await loadMessages(locale);
  vi.unstubAllEnvs();
  return tree;
}

const copy = reference.reviews;
const site = getSite();
const testimonials = site.testimonials;
const yelp = site.yelp;

if (yelp === undefined) throw new Error("content/site.json has no yelp block");

function card(id: string): HTMLElement {
  const figure = document.querySelector(`[data-review="${id}"]`);
  if (!(figure instanceof HTMLElement)) throw new Error(`no card for "${id}"`);
  const item = figure.parentElement;
  if (!(item instanceof HTMLElement)) throw new Error(`card "${id}" has no list item`);
  return item;
}

const format = (value: number, decimals: number, locale: Locale = routing.defaultLocale) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

/* -------------------------------------------------------------------------- *
 * The page shell (04 §1, 06 §6.2)
 * -------------------------------------------------------------------------- */

describe("the page shell", () => {
  it("composes the subpage shell: one #main, one h1, the route's own kicker", async () => {
    const { container } = await renderPage();

    expect(container.querySelectorAll("main#main")).toHaveLength(1);
    expect(container.querySelector("[data-subpage]")).toHaveAttribute("data-subpage", "reviews");

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(copy.heading);
    expect(headings[0]).toHaveAttribute("id", "reviews-title");

    expect(screen.getByText(copy.kicker)).toBeInTheDocument();
  });

  it("takes the panel's colours from the origin section, not from the route id", async () => {
    const { container } = await renderPage();

    // `site.routes[].homeAnchor` maps `reviews` to `testimonials`, so the shell
    // resolves the role variables from that section and nothing on this page
    // names a colour (04 `D-04.3`).
    const panel = container.querySelector<HTMLElement>("[data-subpage]");
    expect(panel?.style.getPropertyValue("--section-bg")).toBe("var(--color-bg-testimonials)");
    expect(screen.getAllByRole("link")[0]).toHaveAttribute(
      "href",
      `/${routing.defaultLocale}#testimonials`,
    );
  });

  it("narrows the shell's content column to the page's own cap", async () => {
    const { container } = await renderPage();
    expect(container.querySelector("main#main")).toHaveClass("max-w-235!", "gap-4!", "md:gap-6.5!");
  });

  it("sheds the header stack's bottom margin on both views", async () => {
    const { container } = await renderPage();
    // An important base class does not outrank its own `md:` twin, so the
    // override has to be written twice.
    const stack = container.querySelector("#reviews-title")?.parentElement;
    expect(stack).toHaveClass("mb-0!", "md:mb-0!");
  });
});

/* -------------------------------------------------------------------------- *
 * Metadata (06 `D-06.10`, INV-06.3)
 * -------------------------------------------------------------------------- */

describe("generateMetadata", () => {
  it("builds the canonical from site.json's slug and every locale's hreflang", async () => {
    const locale = routing.defaultLocale;
    const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });

    const slug = site.routes.find((entry) => entry.id === "reviews")?.path;
    expect(metadata.alternates?.canonical).toBe(`/${locale}${slug ?? ""}`);
    expect(Object.keys(metadata.alternates?.languages ?? {})).toHaveLength(
      routing.locales.length + 1,
    );
    expect(metadata.title).toBe(copy.meta.title);
  });

  it("404s a prefix that is not a locale, before it can index LOCALE_META", async () => {
    await expect(generateMetadata({ params: Promise.resolve({ locale: "fr" }) })).rejects.toThrow();
  });
});

/* -------------------------------------------------------------------------- *
 * The header (04 §3.6, 03 §10)
 * -------------------------------------------------------------------------- */

describe("the header", () => {
  it("names the rating once, in full, and hides the glyphs from it", async () => {
    await renderPage();

    const group = screen.getByRole("img", {
      name: reference.common.rating.ariaLabel.replace(
        "{rating, number, rating}",
        format(yelp.rating, 1),
      ),
    });
    expect(within(group).getByText(format(yelp.rating, 1))).toBeInTheDocument();

    // Five decorative glyphs inside the named group, never the rating itself
    // (04 §3.2): the number beside them carries the value.
    const stars = group.querySelector("[aria-hidden]");
    expect(stars?.textContent).toBe("★★★★★");
  });

  it("draws the header stars at StarRow's header size", async () => {
    await renderPage();

    // 18/24px against this header's drawn 17/22 (M L418, D L518). 22 sits
    // exactly between `text-xl` and `text-2xl`, so no step is nearer and
    // `header` — the size the home section's rating row also takes — stands.
    const group = screen.getByRole("img");
    expect(group.querySelector("[aria-hidden]")).toHaveClass("text-lg", "md:text-2xl");
  });

  it("keeps the Yelp badge outside the rating group", async () => {
    await renderPage();

    const group = screen.getByRole("img");
    const badge = screen.getByText(reference.common.brand.yelp);
    // `role="img"` replaces its subtree for a screen reader, and the badge is a
    // word of its own — so it must be a sibling, not a child.
    expect(group.contains(badge)).toBe(false);
  });

  it("prints the two numbers rather than counting them up", async () => {
    const { container } = await renderPage();
    // The home section animates both and its reference says so with
    // `data-count`; neither subpage reference carries one (D L519–520).
    expect(container.querySelector("[data-countup]")).toBeNull();
  });
});

/* -------------------------------------------------------------------------- *
 * `countLine` — the key this row had to fix (INV-02.2)
 * -------------------------------------------------------------------------- */

describe("the count line", () => {
  it("renders the count and the plural, with the rich tag resolved", async () => {
    const { container } = await renderPage();

    // The loud marker `src/i18n/request.ts` installs for a key that failed to
    // format. `t.rich` falls back to printing it, which is exactly what the old
    // single-argument shape did.
    expect(document.body.textContent).not.toContain("⟦");

    const expected = copy.countLine
      .replace("<count>{reviews, number}</count>", format(yelp.reviewCount, 0))
      .replace("{reviews, plural, one {review} other {reviews}}", "reviews");

    // The rendered line is split across elements — `<count>` is a real element
    // — so the assertion is on the paragraph's text rather than on one node.
    const line = container.querySelector("p.text-sub-testimonials-count");
    expect(line?.textContent).toBe(expected);
    expect(line?.querySelector("span")?.textContent).toBe(format(yelp.reviewCount, 0));
  });

  it("selects the singular when the data says one review", async () => {
    // The component, not the page: the count is `site.yelp.reviewCount`, and
    // this is the branch the live data cannot reach.
    const { ReviewsPageHeader } = await import("@/components/pages/reviews/ReviewsPageHeader");
    const { container } = render(
      wrap(
        <ReviewsPageHeader rating={yelp.rating} reviewCount={1} />,
        routing.defaultLocale,
        reference,
      ),
    );

    expect(container.textContent).toContain("1 review and counting");
    expect(container.textContent).not.toContain("reviews and counting");
  });

  it("keeps `count` as the tag and `reviews` as the number, in every locale (INV-02.2)", async () => {
    /*
     * The shape, not a regex over every brace: an ICU plural's *option* names
     * (`one {review}`) look exactly like argument references, which is why
     * `scripts/validate-content.ts` carries a real reader rather than a
     * pattern. Three targeted facts say everything this row changed.
     */
    const shape = (value: string) => ({
      tag: value.includes("<count>") && value.includes("</count>"),
      number: value.includes("{reviews, number}"),
      plural: value.includes("{reviews, plural,"),
      oldShape: value.includes("{count, number}") || value.includes("{count, plural,"),
    });

    const expected = { tag: true, number: true, plural: true, oldShape: false };
    expect(shape(copy.countLine)).toEqual(expected);

    for (const locale of routing.locales) {
      const tree = await productionTree(locale);
      expect(shape(tree.reviews.countLine)).toEqual(expected);
    }
  });
});

/* -------------------------------------------------------------------------- *
 * The list (04 §3.6, 02 `D-02.13`)
 * -------------------------------------------------------------------------- */

describe("the list", () => {
  it("shows every testimonial, including the one the home page drops", async () => {
    await renderPage();

    for (const entry of testimonials) {
      expect(document.querySelector(`[data-review="${entry.id}"]`)).not.toBeNull();
    }
    // The flag has to actually exercise the branch, or the assertion above is
    // true of a page that simply renders whatever it is handed.
    expect(testimonials.some((entry) => !entry.onHome)).toBe(true);
  });

  it("hides the desktop-only card with a class, never with a viewport read", async () => {
    await renderPage();

    for (const entry of testimonials) {
      expect(card(entry.id)).toHaveClass(...(entry.onMobile ? ["flex"] : ["hidden", "md:flex"]));
    }
    expect(testimonials.some((entry) => !entry.onMobile)).toBe(true);
  });

  it("is a <ul> of <figure>s with the quote marks supplied as punctuation", async () => {
    const { container } = await renderPage();

    const list = container.querySelector("ul");
    expect(list?.querySelectorAll(":scope > li")).toHaveLength(testimonials.length);

    const first = testimonials[0];
    const quote = document.querySelector(`[data-review="${first?.id ?? ""}"] blockquote`);
    expect(quote?.textContent?.startsWith(reference.common.punctuation.quoteOpen)).toBe(true);
    expect(quote?.textContent?.endsWith(reference.common.punctuation.quoteClose)).toBe(true);
  });

  it("renders the <em> a stored quote carries as an element, not as brackets", async () => {
    await renderPage();

    const withEm = testimonials.find((entry) => {
      const text =
        reference.collections.testimonials[
          entry.id as keyof typeof reference.collections.testimonials
        ];
      return text.quote.includes("<em>");
    });
    expect(withEm).toBeDefined();

    const figure = document.querySelector(`[data-review="${withEm?.id ?? ""}"]`);
    expect(figure?.querySelector("em")).not.toBeNull();
    expect(figure?.textContent).not.toContain("<em>");
  });

  it("stacks the cards below md and pairs them above it", async () => {
    const { container } = await renderPage();
    expect(container.querySelector("ul")).toHaveClass("grid-cols-1", "md:grid-cols-2");
  });

  it("draws each card's stars at the 12/14px the reference gives them", async () => {
    await renderPage();

    // The size this page was drawn at (M L422, D L524), and exact on both
    // views. The cards used to render at `StarRow`'s `bubble` — 14/16px —
    // because the component lived in the home section and that was the default
    // it offered; `size` is required now and this row names its own
    // (gp-dln.216).
    for (const entry of testimonials) {
      const stars = document.querySelector(`[data-review="${entry.id}"] > [aria-hidden]`);
      expect(stars).toHaveTextContent("★★★★★");
      expect(stars).toHaveClass("text-xs", "md:text-sm");
    }
  });
});

/* -------------------------------------------------------------------------- *
 * The Yelp button (04 §3.6)
 * -------------------------------------------------------------------------- */

describe("the Yelp button", () => {
  it("is an outbound link to site.yelp.url with the new-tab hint in its name", async () => {
    await renderPage();

    const link = screen.getByRole("link", {
      name: `${copy.yelpCta} ${reference.common.links.newTab}`,
    });
    expect(link).toHaveAttribute("href", yelp.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("wears the Yelp pill recipe rather than a second copy of it", async () => {
    await renderPage();

    const link = screen.getByRole("link", { name: new RegExp(reference.common.links.newTab, "u") });
    expect(link).toHaveClass("bg-yelp", "shadow-yelp", "rounded-pill", "min-h-(--tap-min)");
  });
});

/* -------------------------------------------------------------------------- *
 * The server's own markup
 * -------------------------------------------------------------------------- */

describe("the static markup", () => {
  it("carries every review and both numbers before any JavaScript runs", async () => {
    intlFixture.locale = routing.defaultLocale;
    const html = renderToStaticMarkup(wrap(await ReviewsPage(), routing.defaultLocale, reference));

    expect(html).toContain(format(yelp.rating, 1));
    expect(html).toContain(format(yelp.reviewCount, 0));
    for (const entry of testimonials) expect(html).toContain(`data-review="${entry.id}"`);
    expect(html).not.toContain("⟦");
  });
});
