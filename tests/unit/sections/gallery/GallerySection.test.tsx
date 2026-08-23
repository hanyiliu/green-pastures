import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import GallerySection from "@/components/sections/gallery/GallerySection";
import { DESKTOP_SLOTS, MOBILE_SLOTS } from "@/components/sections/gallery/layout";
import type { GalleryPhotoEntry } from "@/content/collections";
import { getSite } from "@/content/site";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { loadMessages, reference, type Messages } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";

import {
  installIntersectionObserverStub,
  type IntersectionObserverStub,
} from "../../motion/harness";

/**
 * The gallery (04 §Sections; 05 §5.2, §5.3, §5.10; D L215–232, M L145–159).
 *
 * The row's own acceptance is four claims, and each is checked against the
 * content tree rather than against a number typed in here:
 *
 * - **seven polaroids on the wide view and five on the narrow one, from
 *   `onHome`/`onMobile`** — one DOM, the two omitted photos hidden by CSS
 *   (`D-04.5`), never a viewport branch in JavaScript;
 * - **the `polaroid` variant chosen by index parity** — even flies in from the
 *   left, odd from the right (05 §5.2), which is observable as the hidden
 *   state's inline transform;
 * - **the resting tilt is on the inner frame, and the entrance is not** — the
 *   two live on different elements on purpose (05 §5.2, `D-05.12`), and the
 *   hover straightens the frame alone;
 * - **`alt` comes from the collection**, and positions and rotations from
 *   `layout.ts` (`D-04.6`), not from either component.
 *
 * ── Why this file mocks two modules ──────────────────────────────────────
 *
 * `src/content/collections.ts` throws on import when `window` is defined — it
 * is server-only by construction (02 `D-02.16`) and this suite runs in jsdom,
 * because the thing under test renders. So the join it performs is done here
 * instead, over the *real* `content/site.json` and the *real* message tree, and
 * handed back through the mock. `next-intl/server` is mocked for the same
 * reason in reverse: `getTranslations` needs a request scope that only Next
 * supplies, so the mock builds a genuine translator over the same tree with
 * `createTranslator`. Neither mock invents copy or data.
 */

/** What the two mocks answer with; {@link renderGallery} sets it before each render. */
type GalleryTestState = { readonly locale: Locale; readonly messages: Messages };

const state = vi.hoisted((): { current: GalleryTestState | null } => ({ current: null }));
const nav = vi.hoisted(() => ({ pathname: "/" }));

function currentState(): GalleryTestState {
  if (state.current === null) throw new Error("renderGallery has not chosen a locale yet.");
  return state.current;
}

vi.mock("@/i18n/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/navigation")>();
  return { ...actual, usePathname: () => nav.pathname };
});

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getLocale: () => Promise.resolve(currentState().locale),
    getTranslations: (namespace: string) => {
      if (namespace !== "home.gallery") {
        throw new Error(`The gallery asked for the namespace "${namespace}".`);
      }
      const { locale, messages } = currentState();
      return Promise.resolve(
        createTranslator({
          locale,
          messages,
          namespace: "home.gallery",
          formats,
          timeZone: TIME_ZONE,
        }),
      );
    },
  };
});

vi.mock("@/content/collections", () => ({
  getGallery: () => Promise.resolve({ categories: [], photos: joinedPhotos() }),
}));

/** A photo id, as the reference tree's `collections.gallery.photos` keys it. */
type PhotoId = keyof typeof reference.collections.gallery.photos;

/**
 * The join `src/content/collections.ts` performs: `site.gallery.photos[]`
 * against this locale's `collections.gallery.photos.<id>` (02 `D-02.11`).
 */
function joinedPhotos(): readonly GalleryPhotoEntry[] {
  const { messages } = currentState();
  return getSite().gallery.photos.map((photo) => {
    const text = messages.collections.gallery.photos[photo.id as PhotoId];
    if (text === undefined) throw new Error(`No text for photo "${photo.id}".`);
    return { ...photo, text };
  });
}

let observer: IntersectionObserverStub;

beforeAll(() => {
  observer = installIntersectionObserverStub();
});

beforeEach(() => {
  nav.pathname = "/";
  state.current = { locale: routing.defaultLocale, messages: reference };
  resetRevealRegistry();
});

async function renderGallery(
  locale: Locale = routing.defaultLocale,
  messages: Messages = reference,
) {
  state.current = { locale, messages };

  const section = await GallerySection();

  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      formats={formats}
      timeZone={TIME_ZONE}
    >
      <MotionProvider>{section}</MotionProvider>
    </NextIntlClientProvider>,
  );
}

/** The message tree production would assemble for a locale (02 `D-02.8`). */
async function productionTree(locale: Locale): Promise<Messages> {
  vi.stubEnv("NODE_ENV", "production");
  const tree = await loadMessages(locale);
  vi.unstubAllEnvs();
  return tree;
}

const copy = reference.home.gallery;
const gallery = getSite().gallery;
const onHome = gallery.photos.filter((photo) => photo.onHome);
const onHomeAndMobile = onHome.filter((photo) => photo.onMobile);

function polaroids(container: HTMLElement): readonly HTMLElement[] {
  return [...container.querySelectorAll("li")];
}

function frameOf(item: HTMLElement): HTMLElement {
  const figure = item.querySelector("figure");
  if (!(figure instanceof HTMLElement)) throw new Error("a polaroid with no frame");
  return figure;
}

/* -------------------------------------------------------------------------- *
 * The section shell (INV-04.8, 04 §7)
 * -------------------------------------------------------------------------- */

describe("the gallery section", () => {
  it("is the `gallery` section, labelled by its own h2", async () => {
    const { container } = await renderGallery();

    const section = container.querySelector("section");
    expect(section).toHaveAttribute("id", "gallery");
    expect(section).toHaveAttribute("data-section", "gallery");

    const heading = screen.getByRole("heading", { level: 2 });
    expect(section).toHaveAttribute("aria-labelledby", heading.id);
  });

  it("bleeds its horizontal padding to 10px below `md` and takes the token above", async () => {
    const { container } = await renderGallery();
    const className = container.querySelector("section")?.className ?? "";

    // Both important: each replaces a property the `Section` recipe sets.
    expect(className).toContain("px-2.5!");
    expect(className).toContain("md:px-(--section-px)!");
  });

  it("clips nothing — no overflow, contain or content-visibility anywhere (INV-05.2)", async () => {
    const { container } = await renderGallery();

    for (const element of container.querySelectorAll("*")) {
      expect(element.className.toString()).not.toMatch(
        /\b(overflow-(hidden|clip|auto)|contain-paint|content-visibility)/u,
      );
    }
  });
});

/* -------------------------------------------------------------------------- *
 * Copy (INV-02.1, D-04.5, D-04.17)
 * -------------------------------------------------------------------------- */

describe("the copy is the content tree's", () => {
  it("renders the eyebrow and the link label from `home.gallery`", async () => {
    await renderGallery();

    expect(screen.getByText(copy.eyebrow)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.link })).toBeInTheDocument();
  });

  it("fills the title's {brandShortName} from site.json, never a literal (D-04.17)", async () => {
    await renderGallery();

    const brandShortName = getSite().brand.shortName[routing.defaultLocale];
    const expected = copy.title.replace("{brandShortName}", brandShortName);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(expected);
    // The rejected copy 02 D-02.19 retired must never come back.
    expect(document.body.textContent).not.toContain("绿茵园");
  });

  it("draws the intro on the wide view only, by CSS and not by a branch", async () => {
    await renderGallery();

    const intro = screen.getByText(copy.intro);
    expect(intro.className).toMatch(/\bhidden\b/u);
    expect(intro.className).toContain("md:block");
  });

  it("sends the closing link to the gallery route from site.json", async () => {
    await renderGallery();

    const route = getSite().routes.find((entry) => entry.id === "gallery");
    expect(screen.getByRole("link", { name: copy.link })).toHaveAttribute(
      "href",
      `/${routing.defaultLocale}${route?.path ?? ""}`,
    );
  });
});

/* -------------------------------------------------------------------------- *
 * The wall: membership and slots (D-04.5, D-04.6)
 * -------------------------------------------------------------------------- */

describe("the wall draws seven photos and hides two of them below lg", () => {
  it("renders one list item per `onHome` photo, in site.json order", async () => {
    const { container } = await renderGallery();

    const items = polaroids(container);
    expect(items).toHaveLength(onHome.length);
    expect(items.map((item) => frameOf(item).id)).toEqual(
      onHome.map((photo) => `deco-gallery-${photo.id}`),
    );
  });

  it("hides exactly the photos flagged `onMobile: false`, rather than dropping them", async () => {
    const { container } = await renderGallery();

    const hidden = polaroids(container).filter((item) => item.className.includes("hidden"));
    expect(hidden).toHaveLength(onHome.length - onHomeAndMobile.length);
    expect(hidden.map((item) => frameOf(item).id)).toEqual(
      onHome.filter((photo) => !photo.onMobile).map((photo) => `deco-gallery-${photo.id}`),
    );
    for (const item of hidden) expect(item.className).toContain("lg:block");
  });

  it("leaves five polaroids visible below lg — the narrow view's count", async () => {
    const { container } = await renderGallery();

    const shown = polaroids(container).filter((item) => !item.className.includes("hidden"));
    expect(shown).toHaveLength(MOBILE_SLOTS.length);
    expect(shown).toHaveLength(onHomeAndMobile.length);
  });

  it("takes every position and every rotation from layout.ts, not from a component", async () => {
    const { container } = await renderGallery();

    polaroids(container).forEach((item, index) => {
      const slot = DESKTOP_SLOTS[index];
      expect(slot).toBeDefined();
      expect(item.className).toContain(slot?.position ?? "");
      expect(frameOf(item).className).toContain(slot?.tilt ?? "");
      // The narrow anchors must not survive into the left-anchored wide layout.
      expect(item.className).toContain("lg:right-auto");
    });
  });
});

/* -------------------------------------------------------------------------- *
 * The photographs (INV-02.3, INV-04.6, D-04.12)
 * -------------------------------------------------------------------------- */

describe("every photograph", () => {
  it("reserves its box as a PhotoSlot carrying the collection's alt", async () => {
    const { container } = await renderGallery();

    for (const photo of onHome) {
      const slot = container.querySelector(`[data-photo-slot="${photo.id}"]`);
      const alt =
        reference.collections.gallery.photos[
          photo.id as keyof typeof reference.collections.gallery.photos
        ].alt;

      expect(slot).toHaveAttribute("role", "img");
      expect(slot).toHaveAttribute("aria-label", alt);
      expect(slot?.className).toContain("rounded-polaroid");
    }
  });

  it("gives every photo a different alt — no slot is repeating its neighbour's", async () => {
    const { container } = await renderGallery();

    const labels = [...container.querySelectorAll("[data-photo-slot]")].map((slot) =>
      slot.getAttribute("aria-label"),
    );
    expect(new Set(labels).size).toBe(onHome.length);
  });

  it("sits in a `figure` inside a `ul`/`li`, so the wall reads as a list", async () => {
    const { container } = await renderGallery();

    const list = container.querySelector("ul");
    expect(list).toHaveAttribute("data-reveal-id", "gallery.polaroids");
    for (const item of polaroids(container)) {
      expect(item.parentElement).toBe(list);
      expect(frameOf(item).querySelector("[data-photo-slot]")).not.toBeNull();
    }
  });
});

/* -------------------------------------------------------------------------- *
 * Motion (05 §5.2, §5.3, §5.10; INV-05.4, INV-05.9)
 * -------------------------------------------------------------------------- */

describe("the entrances", () => {
  it("flies even indexes in from the left and odd ones from the right (05 §5.2)", async () => {
    const { container } = await renderGallery();

    polaroids(container).forEach((item, index) => {
      const expected = index % 2 === 0 ? "translateX(-150px)" : "translateX(150px)";
      expect(item.style.transform).toContain(expected);
      expect(item.style.transform).toContain(index % 2 === 0 ? "rotate(-10deg)" : "rotate(10deg)");
    });
  });

  it("keeps the entrance on the outer layer and the resting tilt on the inner frame", async () => {
    const { container } = await renderGallery();

    for (const item of polaroids(container)) {
      // Motion owns the item's transform, and its origin is the plain centre.
      expect(item.style.transform).toContain("translateX");
      expect(item.style.transformOrigin).toBe("50% 50%");
      // The frame is never transformed by Motion; its tilt is a class.
      const frame = frameOf(item);
      expect(frame.style.transform).toBe("");
      expect(frame.className).toMatch(/rotate-\[-?\d+(?:\.\d+)?deg\]/u);
    }
  });

  it("straightens and lifts the frame on hover, gated on motion-safe (D-05.12)", async () => {
    const { container } = await renderGallery();

    for (const item of polaroids(container)) {
      const className = frameOf(item).className;
      // Important, because the tilt it undoes is a `lg:` rule on the same property.
      expect(className).toContain("motion-safe:hover:rotate-none!");
      expect(className).toContain("motion-safe:hover:scale-103");
      // 05 §5.10 reuses --dur-word-swap rather than minting a hover duration.
      expect(className).toContain("duration-(--dur-word-swap)");
      expect(className).toContain("ease-soft");
    }
  });

  it("never transforms the stagger container itself (INV-05.4)", async () => {
    const { container } = await renderGallery();

    const list = container.querySelector("ul");
    expect(list?.getAttribute("style") ?? "").not.toContain("transform");
  });

  it("adds three observed reveals and no second observer (INV-05.9)", async () => {
    const { container } = await renderGallery();

    const ids = [...container.querySelectorAll("[data-reveal-id]")].map((element) =>
      element.getAttribute("data-reveal-id"),
    );
    expect(ids).toEqual(["gallery.header", "gallery.polaroids", "gallery.link"]);

    expect(observer.observedCount()).toBe(3);
    const options = observer.constructed.map((entry) => JSON.stringify(entry));
    expect(new Set(options).size).toBeLessThanOrEqual(1);
  });
});

/* -------------------------------------------------------------------------- *
 * Every locale (04 §8)
 * -------------------------------------------------------------------------- */

describe("every id in routing.locales", () => {
  it.each(routing.locales)("renders %s's own title and alt text, not a marker", async (locale) => {
    const messages = await productionTree(locale);
    const { container } = await renderGallery(locale, messages);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).not.toContain("⟦");
    expect(heading).toHaveTextContent(
      messages.home.gallery.title.replace("{brandShortName}", getSite().brand.shortName[locale]),
    );

    for (const photo of onHome) {
      const slot = container.querySelector(`[data-photo-slot="${photo.id}"]`);
      expect(slot?.getAttribute("aria-label") ?? "").not.toBe("");
    }
  });

  it("names the daycare differently in each locale — the short name is configuration", () => {
    const names = routing.locales.map((locale) => getSite().brand.shortName[locale]);
    expect(new Set(names).size).toBeGreaterThan(1);
  });
});
