import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_META, routing } from "@/i18n/routing";
import { canonicalUrl, HOME_HREF } from "@/lib/seo/urls";

import { intlFixture } from "./intl-server";

vi.mock("next-intl/server", async () => {
  const { createIntlServerStub } = await import("./intl-server");
  return createIntlServerStub();
});

const { ChildCareJsonLd, JsonLdScript } = await import("@/lib/seo/JsonLd");

/**
 * The `<script type="application/ld+json">` element (06 §6.6).
 *
 * jsdom is the point: the escape has to survive being parsed as HTML, so the
 * assertions read the element out of a real document rather than reading the
 * string the serialiser returned.
 */
function scriptIn(container: HTMLElement): HTMLScriptElement {
  const script = container.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
  if (script === null) throw new Error("No ld+json script was rendered.");
  return script;
}

/** The rendered object, read back out of the document rather than the serialiser. */
function graphIn(container: HTMLElement): Record<string, unknown> {
  return JSON.parse(scriptIn(container).textContent ?? "") as Record<string, unknown>;
}

beforeEach(() => {
  intlFixture.locale = routing.defaultLocale;
});

describe("JsonLdScript", () => {
  it("renders one ld+json script whose text parses back to the object", () => {
    const data = { "@type": "ChildCare", name: "Green Pastures" };
    const { container } = render(<JsonLdScript data={data} />);

    expect(JSON.parse(scriptIn(container).textContent ?? "")).toEqual(data);
  });

  it("cannot be closed early by a content value containing </script>", () => {
    const { container } = render(<JsonLdScript data={{ name: "</script><b>escaped</b>" }} />);
    const script = scriptIn(container);

    // The element is still the only thing rendered, and nothing leaked into the
    // document as markup.
    expect(container.querySelectorAll("script")).toHaveLength(1);
    expect(container.querySelector("b")).toBeNull();
    expect(script.textContent).not.toContain("<");
    expect(JSON.parse(script.textContent ?? "")).toEqual({ name: "</script><b>escaped</b>" });
  });
});

describe("ChildCareJsonLd", () => {
  it("renders the business object for the locale the request is in", async () => {
    for (const locale of routing.locales) {
      intlFixture.locale = locale;

      const { container } = render(await ChildCareJsonLd());
      const graph = graphIn(container);

      expect(graph["@type"]).toBe("ChildCare");
      expect(graph["@id"]).toBe(`${canonicalUrl(locale, HOME_HREF)}#business`);
      expect(graph.inLanguage).toBe(LOCALE_META[locale].htmlLang);
      expect(graph.description).toBeTruthy();
      expect(String(graph.description)).not.toContain("⟦");
    }
  });

  it("uses home.meta.description — the same sentence the <meta> tag carries", async () => {
    const { reference } = await import("@/i18n/messages");
    const { container } = render(await ChildCareJsonLd());
    const graph = graphIn(container);

    expect(graph.description).toBe(reference.home.meta.description);
  });
});
