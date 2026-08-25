import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { navLabel, resolveNavItems, SiteHeader } from "@/components/layout/SiteHeader";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { getSite } from "@/content/site";
import { reference } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

/**
 * The sticky nav (04 §3.1, `D-04.9`; 06 `D-06.6`, `D-06.7`).
 *
 * Three contracts meet in this component and each has a way of failing
 * silently. Nav membership and every target come from `content/site.json`, so
 * the tests read the same file rather than listing links. The row's height is
 * `--nav-h` itself, because `scroll-margin-top: var(--nav-h)` on every section
 * is only correct while the two agree. And the labels come from
 * `common.nav.<id>`, resolved on the server, so a missing one has to fail loudly
 * instead of shipping a `⟦…⟧` marker into the nav bar.
 */

const nav = vi.hoisted(() => ({ pathname: "/", replace: vi.fn() }));

vi.mock("@/i18n/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/navigation")>();
  return {
    ...actual,
    usePathname: () => nav.pathname,
    useRouter: () => ({
      replace: nav.replace,
      push: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    }),
  };
});

function renderHeader() {
  return render(
    <NextIntlClientProvider locale={routing.defaultLocale} messages={reference}>
      <MotionProvider>
        <SiteHeader />
      </MotionProvider>
    </NextIntlClientProvider>,
  );
}

function navLinks(): HTMLAnchorElement[] {
  const landmark = screen.getByRole("navigation");
  return [...landmark.querySelectorAll("a")];
}

beforeEach(() => {
  nav.pathname = "/";
});

function row(container: HTMLElement): HTMLElement {
  const element = container.querySelector("header > div:not([aria-hidden])");
  if (!(element instanceof HTMLElement)) throw new Error("no nav row rendered");
  return element;
}

describe("the row is exactly --nav-h tall (03 §4, 05 D-05.11)", () => {
  it("binds the row's height to the token rather than to the sum of its parts", () => {
    const { container } = renderHeader();

    expect(row(container).className).toContain("h-(--nav-h)");
  });

  it("is sticky at the top and never transformed (INV-05.4)", () => {
    const { container } = renderHeader();

    const header = container.querySelector("header");
    expect(header?.className).toContain("sticky");
    expect(header?.className).toContain("top-0");
    expect(header?.className).not.toMatch(/\btranslate|\bscale-|\brotate-/u);
  });

  it("keeps the design's tint and blur on their own layer, out of the row", () => {
    const { container } = renderHeader();

    const backdrop = container.querySelector('header > div[aria-hidden="true"]');
    expect(backdrop).toHaveStyle({ backdropFilter: "blur(6px)" });
    expect(backdrop?.className).toContain("bg-nav-bg");
    expect(row(container).getAttribute("style")).toBeNull();
  });

  /**
   * `backdrop-filter` makes an element the containing block for every `fixed`
   * descendant, and the hamburger sheet is a `fixed` panel rendered inside this
   * header. When the filter sat on `<header>` the sheet resolved `bottom: 0`
   * against the 58 px nav bar and rendered 64 px tall (measured in a browser at
   * 375 px; 754 px once the filter moved). jsdom has no layout, so the check
   * here is the structural one that caused it: nothing between the sheet and
   * the document may carry a filter.
   */
  it("puts no backdrop-filter anywhere above the sheet", () => {
    const { container } = renderHeader();
    fireEvent.click(screen.getByLabelText(reference.common.nav.menuOpen));

    let node: HTMLElement | null = screen.getByRole("dialog");
    const filtered: string[] = [];
    while (node !== null && node !== container) {
      const style = node.getAttribute("style") ?? "";
      if (/backdrop-filter/u.test(style)) filtered.push(node.tagName);
      node = node.parentElement;
    }

    expect(filtered).toEqual([]);
  });
});

describe("the link set is content, not code (02 D-02.12, 06 D-06.6)", () => {
  it("renders one nav link per site.nav.primary[] entry, labelled from common.nav", () => {
    renderHeader();

    expect(navLinks().map((link) => link.textContent)).toEqual(
      getSite().nav.primary.map(
        (item) => (reference.common.nav as Record<string, string>)[item.id],
      ),
    );
  });

  it("targets the home anchor of each entry's route, not the subpage", () => {
    renderHeader();
    const site = getSite();

    expect(navLinks().map((link) => link.getAttribute("href"))).toEqual(
      site.nav.primary.map((item) => {
        const route = site.routes.find((entry) => entry.id === item.routeId);
        return `#${String(route?.homeAnchor)}`;
      }),
    );
  });

  it("switches to the cross-page form away from the home page (D-06.7)", () => {
    nav.pathname = "/menu";
    renderHeader();

    const site = getSite();
    const first = site.nav.primary[0];
    const route = site.routes.find((entry) => entry.id === first?.routeId);

    expect(navLinks()[0]).toHaveAttribute(
      "href",
      `/${routing.defaultLocale}#${String(route?.homeAnchor)}`,
    );
    expect(navLinks()[0]?.getAttribute("href")).not.toContain("/#");
  });

  /**
   * Read off the accessibility tree rather than the `aria-label` attribute, and
   * paired with `SiteFooter`'s: the header keeps `common.nav.label` while the
   * footer landmark answers to `common.nav.footerLabel`, so the two `<nav>`s a
   * page carries no longer announce the same name.
   */
  it("names the nav landmark from common.nav.label", () => {
    renderHeader();

    expect(
      screen.getByRole("navigation", { name: reference.common.nav.label }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: reference.common.nav.footerLabel })).toBeNull();
  });
});

describe("the two switcher variants and the CTA", () => {
  it("mounts exactly one disclosure for the desktop row", () => {
    const { container } = renderHeader();

    expect(container.querySelectorAll("details")).toHaveLength(1);
    expect(
      container.querySelectorAll(`ul[aria-label="${reference.common.localeSwitcher.ariaLabel}"]`),
    ).toHaveLength(0);
  });

  it("puts the flat locale rows inside the sheet, with no second disclosure", () => {
    const { container } = renderHeader();

    fireEvent.click(screen.getByLabelText(reference.common.nav.menuOpen));

    const sheet = screen.getByRole("dialog");
    expect(
      sheet.querySelectorAll(`ul[aria-label="${reference.common.localeSwitcher.ariaLabel}"]`),
    ).toHaveLength(1);
    expect(sheet.querySelectorAll("details")).toHaveLength(0);
    expect(container.querySelectorAll("details")).toHaveLength(1);
  });

  it("points the Book a tour pill at site.nav.cta.href", () => {
    renderHeader();

    const cta = screen.getAllByText(reference.common.nav.bookTour);
    expect(cta.length).toBeGreaterThan(0);
    for (const pill of cta) {
      expect(pill.closest("a")).toHaveAttribute("href", `#${getSite().nav.cta.href.slice(2)}`);
    }
  });
});

describe("resolveNavItems (04 §4, INV-02.3)", () => {
  const site = getSite();
  const label = (id: string) => id;

  it("keeps a raw href verbatim — Contact carries /#visit and must reach the Visit section", () => {
    const contact = site.nav.footer.find((item) => item.href !== undefined);
    expect(contact).toBeDefined();

    const resolved = resolveNavItems(site.nav.footer, site, label);
    expect(resolved.find((item) => item.id === contact?.id)?.href).toBe(contact?.href);
  });

  it("spells a route-backed target as /#<homeAnchor>, with no slash before the # (D-06.6)", () => {
    for (const item of resolveNavItems(site.nav.primary, site, label)) {
      expect(item.href).toMatch(/^\/#[a-z]+$/u);
    }
  });

  it("throws, naming the entry, when a routeId resolves to nothing", () => {
    expect(() => resolveNavItems([{ id: "ghost", routeId: "nowhere" }], site, label)).toThrow(
      /routes\[\] does not declare/u,
    );
  });

  it("throws when a nav id has no common.nav label", () => {
    const translator = (() => "") as unknown as Parameters<typeof navLabel>[0];

    expect(() => navLabel(translator, "ghost")).toThrow(/has no nav\.ghost label/u);
  });

  it("passes an id through when the reference tree does carry its label", () => {
    const translator = ((key: string) => key) as unknown as Parameters<typeof navLabel>[0];

    for (const item of site.nav.footer) {
      expect(navLabel(translator, item.id)).toBe(`nav.${item.id}`);
    }
  });
});
