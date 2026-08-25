import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import GalleryPage, { generateMetadata } from "@/app/[locale]/gallery/page";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import { assignSpans } from "@/components/pages/gallery/layout";
import { routeHref } from "@/components/pages/route-href";
import type { GalleryEntries, GalleryPhotoEntry } from "@/content/collections";
import { getSite } from "@/content/site";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { reference } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";

import { installIntersectionObserverStub, installMatchMedia } from "../motion/harness";
import { intlFixture } from "../seo/intl-server";
import { installDialogStub } from "./dialog";

/**
 * The gallery page (PR-6.5; 04 §3.6, §6; 06 `D-06.1`, `D-06.3`, `D-06.10`;
 * D L480–508, M L383–406).
 *
 * The checks are the ones a green build cannot make, and the row's own
 * acceptance is four of them: the lightbox traps and returns focus and answers
 * `Escape` and the arrows, the filters are data-driven, the surface flags are
 * classes rather than branches, and every visible string comes out of
 * `content/`.
 *
 * Every expectation is **derived** from `content/site.json` and the `en`
 * message tree rather than typed here, so the suite fails when a category is
 * renamed instead of quietly agreeing with a stale copy of the data.
 *
 * ── What jsdom cannot check ──────────────────────────────────────────────
 *
 * jsdom 30 implements none of `<dialog>`'s methods, so `./dialog.ts` installs
 * the three the component calls and nothing else — no top layer, no
 * `::backdrop`, no inertness, no `Escape`. The *focus trap* is therefore
 * asserted as "the platform was asked for a **modal** dialog", not by tabbing
 * out of one, and that is the right level: `D-04.7` chose `<dialog>` precisely
 * so the trap is the browser's, and re-testing the browser belongs in 08's e2e
 * matrix rather than here.
 */

/* -------------------------------------------------------------------------- *
 * Doubles
 * -------------------------------------------------------------------------- */

/**
 * `ViewTransition` is not exported by the published `react` package at any
 * 19.x version — it comes from the canary build Next vendors and aliases at
 * build time — so Vitest resolves an `undefined` element type inside
 * `PageTransition`. `tests/unit/motion/PageTransition.test.tsx` owns the
 * transition-type map; here the boundary only has to render its child.
 */
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

const collection = vi.hoisted((): { entries: unknown } => ({ entries: null }));

vi.mock("@/content/collections", () => ({
  getGallery: () => Promise.resolve(collection.entries),
}));

type Tree = typeof reference;

/** The `en` collection joined with `site.json`, exactly as `collections.ts` does. */
function joinGallery(): GalleryEntries {
  const text = reference.collections.gallery;
  const site = getSite().gallery;

  return {
    categories: site.categories.map((category) => {
      const name = text.categories[category.id as keyof typeof text.categories];
      if (name === undefined) throw new Error(`no en name for category "${category.id}"`);
      return { ...category, name };
    }),
    photos: site.photos.map((photo): GalleryPhotoEntry => {
      const value = text.photos[photo.id as keyof typeof text.photos];
      if (value === undefined) throw new Error(`no en text for photo "${photo.id}"`);
      return { ...photo, text: value };
    }),
  };
}

beforeAll(() => {
  installIntersectionObserverStub();
  installMatchMedia(true);
  installDialogStub();
});

beforeEach(() => {
  intlFixture.locale = routing.defaultLocale;
  collection.entries = joinGallery();
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

async function renderPage(locale: Locale = routing.defaultLocale) {
  intlFixture.locale = locale;
  const page = await GalleryPage();
  return render(wrap(page, locale, reference));
}

const copy = reference.gallery;
const site = getSite();
const photos = site.gallery.photos;
const categories = site.gallery.categories;

function chip(id: string): HTMLElement {
  const button = document.querySelector(`[data-filter="${id}"]`);
  if (!(button instanceof HTMLElement)) throw new Error(`no filter chip "${id}"`);
  return button;
}

/** Every thumbnail in the tree — the filter hides, so this never shortens. */
function thumbnails(): readonly string[] {
  return [...document.querySelectorAll("[data-gallery-photo]")].map(
    (node) => node.getAttribute("data-gallery-photo") ?? "",
  );
}

/**
 * The thumbnails the pressed chip leaves drawn, in DOM order.
 *
 * A cell the *filter* dropped is a bare `hidden`; a cell the narrow view drops
 * is `hidden md:block`, which is still drawn — on the wide view. The two are
 * different states and the test has to tell them apart.
 */
function shown(): readonly string[] {
  return [...document.querySelectorAll("[data-gallery-photo]")]
    .filter((node) => {
      const classes = node.closest("li")?.className.split(/\s+/u) ?? [];
      return !classes.includes("hidden") || classes.includes("md:block");
    })
    .map((node) => node.getAttribute("data-gallery-photo") ?? "");
}

/** The `<li>` a thumbnail sits in — the animated cell. */
function cell(id: string): HTMLElement {
  const item = document.querySelector(`[data-gallery-photo="${id}"]`)?.closest("li");
  if (!(item instanceof HTMLElement)) throw new Error(`no cell for "${id}"`);
  return item;
}

function dialog(): HTMLDialogElement {
  const node = document.querySelector("dialog");
  if (!(node instanceof HTMLDialogElement)) throw new Error("no dialog");
  return node;
}

/* -------------------------------------------------------------------------- *
 * The page shell (04 §1, 06 §6.2)
 * -------------------------------------------------------------------------- */

describe("the page shell", () => {
  it("composes the subpage shell: one #main, one h1, the route's own kicker", async () => {
    const { container } = await renderPage();

    expect(container.querySelectorAll("main#main")).toHaveLength(1);
    expect(container.querySelector("[data-subpage]")).toHaveAttribute("data-subpage", "gallery");

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(copy.heading);
    expect(headings[0]).toHaveAttribute("id", "gallery-title");

    expect(screen.getByText(copy.kicker)).toBeInTheDocument();
  });

  it("points Back at the home anchor content/site.json declares", async () => {
    await renderPage();

    const route = site.routes.find((entry) => entry.id === "gallery");
    expect(screen.getAllByRole("link")[0]).toHaveAttribute(
      "href",
      `/${routing.defaultLocale}#${route?.homeAnchor ?? ""}`,
    );
  });

  it("renders the hint from the message tree, not from a literal", async () => {
    await renderPage();
    expect(screen.getByText(copy.hint)).toBeInTheDocument();
  });

  it("narrows the shell's content column to the page's own cap", async () => {
    const { container } = await renderPage();
    // Important on both halves: an important base class does not outrank its
    // own `md:` twin, which is the measured rule this page's config obeys.
    expect(container.querySelector("main#main")).toHaveClass("max-w-255!", "gap-4!", "md:gap-6!");
  });
});

/* -------------------------------------------------------------------------- *
 * Metadata (06 `D-06.10`, INV-06.3)
 * -------------------------------------------------------------------------- */

describe("generateMetadata", () => {
  it("builds the canonical from site.json's slug and every locale's hreflang", async () => {
    const locale = routing.defaultLocale;
    const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });

    const slug = site.routes.find((entry) => entry.id === "gallery")?.path;
    expect(metadata.alternates?.canonical).toBe(`/${locale}${slug ?? ""}`);

    const languages = metadata.alternates?.languages ?? {};
    // One entry per enabled locale plus `x-default`; the count is derived, so
    // holding a locale back changes it here with no edit to the page.
    expect(Object.keys(languages)).toHaveLength(routing.locales.length + 1);
    expect(metadata.title).toBe(copy.meta.title);
    expect(metadata.description).toBe(copy.meta.description);
  });

  it("404s a prefix that is not a locale, before it can index LOCALE_META", async () => {
    // `generateMetadata` runs before the layout body, so the guard has to be
    // here too or an unknown prefix reaches `buildMetadata` first (06 §6.2).
    await expect(generateMetadata({ params: Promise.resolve({ locale: "fr" }) })).rejects.toThrow();
  });

  it("refuses to build an href for a namespace content/site.json has no route for", () => {
    // The reserved pages carry a kicker before they carry a route (`D-02.17`);
    // a canonical for a URL that does not exist is worse than a build failure.
    expect(() => routeHref("visit")).toThrow(/does not declare it in routes\[\]/u);
  });
});

/* -------------------------------------------------------------------------- *
 * The filter chips (04 §3.6)
 * -------------------------------------------------------------------------- */

describe("the filters", () => {
  it("draws All plus every category, labelled from the collection", async () => {
    await renderPage();

    const group = screen.getByRole("group", { name: copy.heading });
    expect(within(group).getAllByRole("button")).toHaveLength(categories.length + 1);

    expect(chip("all")).toHaveTextContent(copy.filters.all);
    for (const category of categories) {
      const name =
        reference.collections.gallery.categories[
          category.id as keyof typeof reference.collections.gallery.categories
        ];
      expect(chip(category.id)).toHaveTextContent(name);
    }
  });

  it("opens with All pressed and moves the pressed state on a click", async () => {
    await renderPage();

    const outdoors = categories.find((entry) => entry.id === "outdoors");
    expect(outdoors).toBeDefined();

    expect(chip("all")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(chip("outdoors"));
    expect(chip("outdoors")).toHaveAttribute("aria-pressed", "true");
    expect(chip("all")).toHaveAttribute("aria-pressed", "false");
  });

  it("filters the grid by the category the data declares", async () => {
    await renderPage();

    for (const category of categories) {
      fireEvent.click(chip(category.id));
      expect(shown()).toEqual(
        photos.filter((photo) => photo.category === category.id).map((photo) => photo.id),
      );
      // Hidden, never unmounted — every photograph stays in the tree.
      expect(thumbnails()).toEqual(photos.map((photo) => photo.id));
    }

    fireEvent.click(chip("all"));
    expect(shown()).toEqual(photos.map((photo) => photo.id));
  });

  it("never unmounts a thumbnail, so its entrance cannot be stranded", async () => {
    await renderPage();

    /*
     * The regression this guards. A `RevealItem` inherits `hidden` from the
     * `Reveal stagger` above it and is driven to `visible` when that
     * container's `whileInView` fires — once. A thumbnail unmounted on one
     * filter and mounted again on the next inherits `hidden` from a container
     * that will never animate again, and sits at `opacity: 0` in a cell it
     * still occupies. Measured in chromium before the fix: six of eight.
     *
     * Node identity is the assertion, because that is exactly what "was never
     * unmounted" means.
     */
    const before = cell("g01");
    fireEvent.click(chip("meals"));
    fireEvent.click(chip("all"));

    expect(cell("g01")).toBe(before);
    expect(cell("g01").className).not.toMatch(/(^|\s)hidden(\s|$)/u);
  });

  it("is a Chip: the pressed pill is sage, the rest are the cool recipe", async () => {
    await renderPage();

    // `Chip` is the span inside the button — the button is the hit area and the
    // pressed state, the chip is every pixel that paints (04 §5.5).
    const pressed = chip("all").firstElementChild;
    const unpressed = chip("meals").firstElementChild;

    expect(pressed).toHaveClass("bg-sage", "text-white", "shadow-none!");
    expect(unpressed).toHaveClass("bg-white", "shadow-chip-cool");
    // `--section-link` resolves to the gallery's own link colour through
    // `SubpageBar`'s role variables; the chip never names a section colour.
    expect(unpressed).toHaveClass("text-(color:--section-link)");
  });

  it("hides a desktop-only category with a class, never with a viewport read", async () => {
    await renderPage();

    for (const category of categories) {
      expect(chip(category.id)).toHaveClass(
        ...(category.onMobile ? ["inline-flex"] : ["hidden", "md:inline-flex"]),
      );
    }
    // The data has to actually exercise the branch, or the assertion above is
    // true of an empty set.
    expect(categories.some((category) => !category.onMobile)).toBe(true);
  });

  it("gives every chip the 44px hit area without touching the drawn pill", async () => {
    await renderPage();

    expect(chip("all")).toHaveClass("before:h-(--tap-min)", "before:min-w-(--tap-min)");
    // `Chip` sets no size floor of its own — that is the whole reason the
    // button carries one (INV-04.7).
    expect(chip("all").firstElementChild).not.toHaveClass("min-h-(--tap-min)");
  });
});

/* -------------------------------------------------------------------------- *
 * The grid (04 §3.6, `D-04.5`)
 * -------------------------------------------------------------------------- */

describe("the grid", () => {
  it("renders every photograph with its own alt as the button's name", async () => {
    await renderPage();

    expect(thumbnails()).toEqual(photos.map((photo) => photo.id));
    for (const photo of photos) {
      const alt =
        reference.collections.gallery.photos[
          photo.id as keyof typeof reference.collections.gallery.photos
        ].alt;
      expect(screen.getByRole("button", { name: alt })).toBeInTheDocument();
    }
  });

  it("hides the two narrow-view photographs by class, not by filtering", async () => {
    await renderPage();

    for (const photo of photos) {
      expect(cell(photo.id)).toHaveClass(...(photo.onMobile ? ["block"] : ["hidden", "md:block"]));
    }
    expect(photos.some((photo) => !photo.onMobile)).toBe(true);
  });

  it("draws both references' mosaics from one tree", async () => {
    await renderPage();

    const spans = new Map(
      assignSpans(photos).map(({ photo, span }) => [photo.id, span.split(" ").filter(Boolean)]),
    );

    // The wide reference: slots 1, 5 tall (D L499, L503) and slot 7 wide
    // (D L506) over all eight photographs.
    expect(spans.get("g01")).toContain("md:row-span-2");
    expect(spans.get("g05")).toContain("md:row-span-2");
    expect(spans.get("g07")).toContain("md:col-span-2");

    // The narrow reference: its own slots 1 and 5 (M L398, L402) over the six
    // `onMobile` photographs, which puts the second tall slot on `g07` — the
    // photograph the wide view draws *wide*. One index cannot produce both,
    // which is why the spans are positional per view.
    expect(spans.get("g01")).toContain("row-span-2");
    expect(spans.get("g07")).toContain("row-span-2");
    expect(spans.get("g07")).toContain("md:row-span-1");
    expect(spans.get("g05")).not.toContain("row-span-2");
  });

  it("keeps the mosaic when a filter shortens the list", async () => {
    await renderPage();
    fireEvent.click(chip("classroom"));

    const drawn = shown();
    expect(drawn.length).toBeGreaterThan(1);

    // The mosaic walks what is showing, so the first *drawn* cell is the tall
    // one whatever its id — and a hidden cell carries no span at all.
    expect(cell(drawn[0] ?? "")).toHaveClass("row-span-2");
    const dropped = photos.find((photo) => !drawn.includes(photo.id));
    expect(cell(dropped?.id ?? "").className.trim()).toBe("hidden");
  });
});

/* -------------------------------------------------------------------------- *
 * The lightbox (04 §3.6, `D-04.7`)
 * -------------------------------------------------------------------------- */

describe("the lightbox", () => {
  it("stays closed until a thumbnail is pressed, then opens as a modal", async () => {
    await renderPage();

    expect(dialog().open).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: photoAlt("g01") }));
    expect(dialog().open).toBe(true);
    // `showModal()` and not `show()`: the trap, the backdrop and `Escape` are
    // the platform's only in the modal form.
    expect(dialog().getAttribute("aria-label")).toBe(photoAlt("g01"));
  });

  it("labels its three controls from common.lightbox", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: photoAlt("g01") }));

    const box = dialog();
    expect(within(box).getByText(reference.common.lightbox.close)).toBeInTheDocument();
    expect(within(box).getByText(reference.common.lightbox.prev)).toBeInTheDocument();
    expect(within(box).getByText(reference.common.lightbox.next)).toBeInTheDocument();
  });

  it("walks the filtered list with the arrows and wraps at both ends", async () => {
    await renderPage();
    fireEvent.click(chip("meals"));

    const meals = photos.filter((photo) => photo.category === "meals").map((photo) => photo.id);
    expect(meals.length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole("button", { name: photoAlt(meals[0] ?? "") }));
    expect(dialog().getAttribute("aria-label")).toBe(photoAlt(meals[0] ?? ""));

    fireEvent.keyDown(dialog(), { key: "ArrowRight" });
    expect(dialog().getAttribute("aria-label")).toBe(photoAlt(meals[1] ?? ""));

    // Back past the first photograph wraps to the last, so neither control is
    // ever dead and neither needs a disabled state the design does not draw.
    fireEvent.keyDown(dialog(), { key: "ArrowLeft" });
    fireEvent.keyDown(dialog(), { key: "ArrowLeft" });
    expect(dialog().getAttribute("aria-label")).toBe(photoAlt(meals[meals.length - 1] ?? ""));
  });

  it("never leaves the filter: the arrows do not reach a hidden photograph", async () => {
    await renderPage();
    fireEvent.click(chip("outdoors"));

    const outdoors = photos.filter((photo) => photo.category === "outdoors");
    fireEvent.click(screen.getByRole("button", { name: photoAlt(outdoors[0]?.id ?? "") }));

    const seen = new Set<string>();
    for (let step = 0; step < photos.length; step += 1) {
      seen.add(dialog().getAttribute("aria-label") ?? "");
      fireEvent.keyDown(dialog(), { key: "ArrowRight" });
    }
    expect([...seen].sort()).toEqual(outdoors.map((photo) => photoAlt(photo.id)).sort());
  });

  /*
   * The route out of the dialog is part of this assertion rather than a detail
   * of it, and that is the one thing this block cannot take from `./dialog.ts`.
   * A browser restores focus to the *opening* thumbnail **inside** `close()`
   * and only then queues the `close` event, so a correction that travels with
   * the event lands a task late — measured at 0.9–6.2 ms in this project's own
   * Chromium, and red in CI. `Lightbox.dismiss` therefore corrects focus in the
   * same statement as the close, and each route out has to be driven the way
   * the browser delivers it: the button as a click, `Escape` as the `cancel`
   * the platform fires before it closes anything. jsdom implements none of
   * `Escape`, the top layer or the restoration, so the restoration is stood in
   * for here — focus is put back on the opener first, which is the state the
   * component has to correct.
   */
  it("hands focus back to the photograph on screen, not to the one that opened it", async () => {
    await renderPage();

    const stepOffG01 = () => {
      fireEvent.click(screen.getByRole("button", { name: photoAlt("g01") }));
      fireEvent.keyDown(dialog(), { key: "ArrowRight" });
      const onScreen = dialog().getAttribute("aria-label");
      const shown = photos.find((photo) => photoAlt(photo.id) === onScreen);
      expect(shown?.id).not.toBe("g01");
      // What the browser does inside `close()`, and jsdom does not.
      document.getElementById("gallery-photo-g01")?.focus();
      return document.getElementById(`gallery-photo-${shown?.id ?? ""}`);
    };

    const byButton = stepOffG01();
    fireEvent.click(within(dialog()).getByText(reference.common.lightbox.close));
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(byButton);

    const byEscape = stepOffG01();
    fireEvent(dialog(), new Event("cancel", { bubbles: false, cancelable: true }));
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(byEscape);
  });

  it("closes when the reader clicks past the photograph, onto the dialog itself", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: photoAlt("g01") }));
    expect(dialog().open).toBe(true);

    // Everything drawn is a child, so a click whose target *is* the dialog
    // landed on the padding around the photo — the backdrop, as far as a reader
    // is concerned.
    fireEvent.click(dialog());
    expect(dialog().open).toBe(false);

    // A click that lands on the frame is not a click on the backdrop.
    fireEvent.click(screen.getByRole("button", { name: photoAlt("g01") }));
    fireEvent.click(within(dialog()).getByText(reference.common.lightbox.next));
    expect(dialog().open).toBe(true);
  });

  it("leaves the arrows inert when the filter has left one photograph", async () => {
    await renderPage();

    const only = photos.filter((photo) => photo.category === "celebrations");
    expect(only).toHaveLength(1);

    fireEvent.click(chip("celebrations"));
    fireEvent.click(screen.getByRole("button", { name: photoAlt(only[0]?.id ?? "") }));

    fireEvent.keyDown(dialog(), { key: "ArrowRight" });
    fireEvent.keyDown(dialog(), { key: "ArrowLeft" });
    expect(dialog().getAttribute("aria-label")).toBe(photoAlt(only[0]?.id ?? ""));
    expect(dialog().open).toBe(true);
  });

  it("ignores a key the arrows do not own", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: photoAlt("g01") }));
    fireEvent.keyDown(dialog(), { key: "ArrowDown" });
    expect(dialog().getAttribute("aria-label")).toBe(photoAlt("g01"));
  });

  it("closes when a chip is pressed, because the photograph may leave the filter", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: photoAlt("g01") }));
    expect(dialog().open).toBe(true);

    fireEvent.click(chip("meals"));
    expect(dialog().open).toBe(false);
  });
});

/** One photograph's `en` alt — the accessible name of its thumbnail. */
function photoAlt(id: string): string {
  const photos_ = reference.collections.gallery.photos;
  const entry = photos_[id as keyof typeof photos_];
  if (entry === undefined) throw new Error(`no en alt for "${id}"`);
  return entry.alt;
}
