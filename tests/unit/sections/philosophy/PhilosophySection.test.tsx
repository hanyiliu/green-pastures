import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import { revealVariants } from "@/components/motion/variants";
import { PhilosophySection } from "@/components/sections/philosophy/PhilosophySection";
import { getSite } from "@/content/site";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { loadMessages, reference } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";

import {
  installIntersectionObserverStub,
  type IntersectionObserverStub,
} from "../../motion/harness";

/**
 * The Philosophy section (04 §3.5, §6, §7; 05 §5.2, §5.4;
 * `docs/design/desktop/README.md` §2 and `docs/design/mobile/README.md` §2).
 *
 * The checks here are the ones a green build cannot make on its own, and each
 * is something the row would be silently wrong about forever:
 *
 * - the section's **heading is a hidden `h2`, not the visible eyebrow and not
 *   the quote** (04 §7) — the one structural decision in the section, and the
 *   one a later refactor is most likely to "tidy" away;
 * - the pull-quote is a **`<blockquote>` with a `<footer>`**, so the words the
 *   design draws at 44px are quoted material rather than a heading (04 §3);
 * - the quote mark's glyph comes from **`common.punctuation.quoteOpen`**, not
 *   from a `“` typed into a component (INV-02.1);
 * - all three blocks reveal with **`ink`**, and the section adds **no second
 *   IntersectionObserver** (INV-05.9);
 * - the wide view draws **two leaves and the narrow one draws one** (04 §3.4),
 *   the shared one floating below `md` and still above it;
 * - **every locale renders its own copy**, iterated from `routing.locales`.
 *
 * Every expectation is derived from `content/`, `src/design/tokens.ts` or the
 * variant catalogue rather than typed out, so the suite catches a value that
 * stopped matching its source instead of agreeing with itself.
 */

vi.mock("@/i18n/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/navigation")>();
  return { ...actual, usePathname: () => "/" };
});

let observer: IntersectionObserverStub;

beforeAll(() => {
  observer = installIntersectionObserverStub();
});

beforeEach(() => {
  resetRevealRegistry();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

type Tree = typeof reference;

function renderPhilosophy(locale: Locale = routing.defaultLocale, messages: Tree = reference) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      formats={formats}
      timeZone={TIME_ZONE}
    >
      <MotionProvider>
        <PhilosophySection />
      </MotionProvider>
    </NextIntlClientProvider>,
  );
}

const philosophy = reference.home.philosophy;

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

/** A rich message as the reader meets it — the `<em>` stripped, the words kept. */
function plain(message: string): string {
  return message.replace(/<\/?em>/gu, "");
}

/** The `<em>` phrase of a rich message. */
function accentOf(message: string): string {
  return /<em>(?<phrase>[^<]+)<\/em>/u.exec(message)?.groups?.phrase ?? "";
}

/** `home.philosophy.attribution` as it renders, with the brand name filled in. */
function attributionFor(tree: Tree, locale: Locale): string {
  return tree.home.philosophy.attribution.replace(
    "{brandShortName}",
    getSite().brand.shortName[locale],
  );
}

/* -------------------------------------------------------------------------- *
 * Landmarks and headings (INV-04.8, 04 §7)
 * -------------------------------------------------------------------------- */

describe("the section shell", () => {
  it("is the `philosophy` section, labelled by its own h2", () => {
    const { container } = renderPhilosophy();

    const section = container.querySelector("section");
    expect(section).toHaveAttribute("id", "philosophy");
    expect(section).toHaveAttribute("data-section", "philosophy");

    const heading = screen.getByRole("heading", { level: 2 });
    expect(section).toHaveAttribute("aria-labelledby", heading.id);
  });

  it("takes the shared section box — unlike the hero it overrides no padding", () => {
    const { container } = renderPhilosophy();

    const className = container.querySelector("section")?.className ?? "";
    expect(className).toContain("py-(--section-py)");
    expect(className).not.toMatch(/\bp[txyb]?-[\d.]+!/u);
  });

  it("hides the heading and shows the eyebrow as a paragraph (04 §7)", () => {
    renderPhilosophy();

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.tagName).toBe("H2");
    expect(heading).toHaveTextContent(philosophy.eyebrow);
    expect(heading).toHaveClass("sr-only");

    // The same words are also drawn, as a `<p>` — never as the heading.
    const visible = screen
      .getAllByText(philosophy.eyebrow)
      .filter((element) => element.tagName === "P");
    expect(visible).toHaveLength(1);
  });

  it("renders no h1 — the home page's is the hero's (INV-04.8)", () => {
    renderPhilosophy();

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("is the folder's default export, which is the line `page.tsx` takes", async () => {
    const folder = await import("@/components/sections/philosophy");

    expect(folder.default).toBe(PhilosophySection);
    expect(folder.PhilosophySection).toBe(PhilosophySection);
  });
});

/* -------------------------------------------------------------------------- *
 * The pull-quote (04 §3, D L144–146, M L82–84)
 * -------------------------------------------------------------------------- */

describe("the pull-quote", () => {
  it("is a blockquote whose attribution is its footer", () => {
    const { container } = renderPhilosophy();

    const quote = container.querySelector("blockquote");
    expect(quote).toBeInTheDocument();
    expect(quote?.querySelector("p")).not.toBeNull();

    const footer = quote?.querySelector("footer");
    expect(footer).toHaveTextContent(attributionFor(reference, routing.defaultLocale));
  });

  it("fills the brand name from site.brand.shortName, not from the message file", () => {
    renderPhilosophy();

    const shortName = getSite().brand.shortName[routing.defaultLocale];
    expect(screen.getByText(attributionFor(reference, routing.defaultLocale))).toBeInTheDocument();
    expect(screen.queryByText(/\{brandShortName\}/u)).not.toBeInTheDocument();
    expect(shortName.length).toBeGreaterThan(0);
  });

  it("draws the accent phrase from the section role variable (D-04.13)", () => {
    renderPhilosophy();

    const element = screen.getByText(accentOf(philosophy.quote));
    expect(element.tagName).toBe("EM");
    expect(element).toHaveClass("text-(color:--section-accent)", "not-italic");
    expect(element.className).not.toMatch(/--color-accent-/u);
  });

  it("renders the quote's words with the tag stripped", () => {
    const { container } = renderPhilosophy();

    expect(container.querySelector("blockquote")).toHaveTextContent(plain(philosophy.quote));
  });
});

/* -------------------------------------------------------------------------- *
 * The quote mark (04 §3.4, 03 §10)
 * -------------------------------------------------------------------------- */

describe("the quote mark", () => {
  it("takes its glyph from common.punctuation.quoteOpen and stays out of the a11y tree", () => {
    const { container } = renderPhilosophy();

    const mark = container.querySelector('blockquote > [aria-hidden="true"]');
    expect(mark).toHaveTextContent(reference.common.punctuation.quoteOpen);
  });

  it("reaches both tokens by name, because they no longer share a utility stem", () => {
    const { container } = renderPhilosophy();

    // 03 INV-03.7: the size keeps `text-quote-mark` and the colour is
    // `--color-quote-mark-text`, so neither needs an arbitrary modifier. The
    // pair used to be `--text-quote-mark` / `--color-quote-mark`, one stem, and
    // Tailwind emitted the colour alone.
    const mark = container.querySelector('blockquote > [aria-hidden="true"]');
    expect(mark).toHaveClass("text-quote-mark", "text-quote-mark-text");
  });
});

/* -------------------------------------------------------------------------- *
 * The badge row (04 §3.2, §3.5)
 * -------------------------------------------------------------------------- */

describe("the badge row", () => {
  it("renders the credential badge as the solid sage chip the design draws", () => {
    renderPhilosophy();

    const badge = screen.getByText(philosophy.badgeCertified);
    expect(badge).toHaveClass("bg-sage", "text-white");
    // 03 §4 mints no padding token for this chip, so the override is spacing —
    // and important, because `Chip`'s recipe sets padding of its own.
    expect(badge.className).toContain("px-3.5!");
    expect(badge.className).toContain("md:py-2.25!");
  });

  it("never upper-cases the bilingual line (04 §3.2 names this key)", () => {
    renderPhilosophy();

    const bilingual = screen.getByText(philosophy.badgeBilingual);
    expect(bilingual.tagName).toBe("P");
    expect(bilingual.className).not.toMatch(/\buppercase\b/u);
    expect(bilingual.className).not.toMatch(/\btracking-eyebrow\b/u);
  });

  it("links to the philosophy route's path, not to the home anchor", () => {
    renderPhilosophy();

    const route = getSite().routes.find((entry) => entry.id === "philosophy");
    const link = screen.getByRole("link", { name: philosophy.link });

    expect(link).toHaveAttribute("href", `/${routing.defaultLocale}${route?.path ?? ""}`);
    expect(link.getAttribute("href")).not.toContain("#");
  });
});

/* -------------------------------------------------------------------------- *
 * The photo (INV-04.6, D-04.12; 03 §5)
 * -------------------------------------------------------------------------- */

describe("the photo", () => {
  it("reserves the box as a PhotoSlot, carrying the future photo's alt", () => {
    const { container } = renderPhilosophy();

    const slot = container.querySelector('[data-photo-slot="philosophy"]');
    expect(slot).toHaveAttribute("role", "img");
    expect(slot).toHaveAttribute("aria-label", philosophy.photo.alt);
  });

  it("takes 03 §5's two named steps — card-md below `md`, card-lg above", () => {
    const { container } = renderPhilosophy();

    const slot = container.querySelector('[data-photo-slot="philosophy"]');
    expect(slot).toHaveClass("rounded-card-md", "md:rounded-card-lg");
  });
});

/* -------------------------------------------------------------------------- *
 * Motion (05 §5.2, §5.9; INV-05.9)
 * -------------------------------------------------------------------------- */

describe("the three reveals", () => {
  const hidden = revealVariants.ink.hidden;

  it("inks in the quote block, the photo and the badges", () => {
    renderPhilosophy();

    for (const id of ["philosophy.quote", "philosophy.photo", "philosophy.badges"]) {
      const block = reveal(id);
      expect(block.style.opacity).toBe(String(hidden.opacity));
      expect(block.style.transform).toContain(`scale(${String(hidden.scale)})`);
      expect(block.style.filter).toBe(hidden.filter);
    }
  });

  it("observes the three entrances and nothing else (INV-05.9)", () => {
    renderPhilosophy();

    expect(observer.observedCount()).toBe(3);
    const options = observer.constructed.map((entry) => JSON.stringify(entry));
    expect(new Set(options).size).toBeLessThanOrEqual(1);
  });

  it("uses no stagger container — this section has no staggered group", () => {
    const { container } = renderPhilosophy();

    expect(container.querySelectorAll("[data-reveal-id]")).toHaveLength(3);
    // A `RevealItem` is the only `[data-reveal]` without an id of its own.
    expect(container.querySelectorAll("[data-reveal]:not([data-reveal-id])")).toHaveLength(0);
  });

  it("drops the blur under reduced motion — the one track MotionConfig misses", () => {
    render(
      <NextIntlClientProvider
        locale={routing.defaultLocale}
        messages={reference}
        formats={formats}
        timeZone={TIME_ZONE}
      >
        <MotionProvider reducedMotion="always">
          <PhilosophySection />
        </MotionProvider>
      </NextIntlClientProvider>,
    );

    for (const id of ["philosophy.quote", "philosophy.photo", "philosophy.badges"]) {
      const block = reveal(id);
      expect(block.style.opacity).toBe(String(hidden.opacity));
      expect(block.style.filter).toBe("");
      expect(block.style.transform).toBe("");
    }
  });
});

/* -------------------------------------------------------------------------- *
 * Decorations (04 §3.4, INV-04.5, INV-05.5)
 * -------------------------------------------------------------------------- */

const LEAF_IDS = [
  "deco-philosophy-leaf-1",
  "deco-philosophy-leaf-2",
  "deco-philosophy-leaf-3",
] as const;

describe("the decoration layer", () => {
  it("gives every leaf a `deco-*` id, repeated as data-deco, out of the reading order", () => {
    renderPhilosophy();

    for (const id of LEAF_IDS) {
      expect(deco(id)).toHaveAttribute("data-deco", id);
      expect(deco(id)).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("draws one leaf below `md` and two above (04 §3.4)", () => {
    renderPhilosophy();

    const [mobile, ...desktop] = LEAF_IDS;
    expect(deco(mobile).className).toContain("md:hidden");
    expect(deco(mobile).className).not.toMatch(/(^|\s)hidden\b/u);

    for (const id of desktop) {
      expect(deco(id).className).toMatch(/(^|\s)hidden\b/u);
      expect(deco(id).className).toContain("md:block");
    }
  });

  it("floats only the narrow view's leaf — the wide view's two are still", () => {
    renderPhilosophy();

    // M L79 gives the mobile leaf `gpfloat 8s`; D L140/L141 animate neither of
    // the desktop pair, and `loop` is what attaches the keyframes.
    const [mobile, ...desktop] = LEAF_IDS;
    expect(deco(mobile).firstElementChild).toHaveClass("loop");
    for (const id of desktop) {
      expect(deco(id).firstElementChild).not.toHaveClass("loop");
    }
  });

  it("draws the reference's three sizes — 24px on mobile, 34px and 24px on desktop", () => {
    renderPhilosophy();

    expect(deco("deco-philosophy-leaf-1").firstElementChild).toHaveAttribute("width", "24");
    expect(deco("deco-philosophy-leaf-2").firstElementChild).toHaveAttribute("width", "34");
    expect(deco("deco-philosophy-leaf-3").firstElementChild).toHaveAttribute("width", "24");
  });

  it("tints every leaf with the philosophy leaf token, never a colour name", () => {
    renderPhilosophy();

    for (const id of LEAF_IDS) {
      expect(deco(id).querySelector("path")).toHaveClass("fill-leaf-philosophy");
    }
  });
});

/* -------------------------------------------------------------------------- *
 * Every locale (04 §8)
 * -------------------------------------------------------------------------- */

describe("every id in routing.locales", () => {
  it.each(routing.locales)("renders %s's own quote, not a marker", async (locale) => {
    const messages = await productionTree(locale);
    const { container } = renderPhilosophy(locale, messages);

    const quote = container.querySelector("blockquote");
    expect(quote).toHaveTextContent(plain(messages.home.philosophy.quote));
    expect(quote?.textContent).not.toContain("⟦");
  });

  it("renders a different quote in each locale — no tree is falling back to another", async () => {
    const quotes: string[] = [];

    for (const locale of routing.locales) {
      const messages = await productionTree(locale);
      const { container, unmount } = renderPhilosophy(locale, messages);
      quotes.push(container.querySelector("blockquote")?.textContent ?? "");
      unmount();
      resetRevealRegistry();
    }

    expect(new Set(quotes).size).toBe(routing.locales.length);
  });

  it("fills the attribution with each locale's own brand short name", async () => {
    for (const locale of routing.locales) {
      const messages = await productionTree(locale);
      const { unmount } = renderPhilosophy(locale, messages);

      expect(screen.getByText(attributionFor(messages, locale))).toBeInTheDocument();
      unmount();
      resetRevealRegistry();
    }
  });
});
