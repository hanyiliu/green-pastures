import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TIME_ZONE, formats } from "@/i18n/formats";
import { loadMessages } from "@/i18n/messages";
import { LOCALE_META, routing, type Locale } from "@/i18n/routing";
import { parseInquiry, type Inquiry } from "@/lib/inquiry/schema";
import { renderAutoReply, renderStaffNotification } from "@/lib/inquiry/server/email";

import { NOW, rawSubmission } from "./fixtures";

/**
 * The two e-mail templates (07 §8 *Email templates*).
 *
 * "Render the staff notification and the auto-reply in **every locale in
 * `routing.locales`** — the suite iterates the list, it does not name locales."
 * It does that below; adding a locale adds rows without an edit here.
 *
 * The Chinese message files are `{}` today — the phased-translation window
 * (02 `D-02.8`) — so the translators are built from `loadMessages` with
 * production semantics, which is the deep merge over `en` that the site itself
 * performs. That is the honest fixture: it renders what a parent would actually
 * receive today, English, rather than a tree no environment produces.
 */

async function translatorsFor(locale: Locale) {
  vi.stubEnv("NODE_ENV", "production");
  const messages = await loadMessages(locale);
  vi.unstubAllEnvs();

  const shared = { locale, messages, formats, timeZone: TIME_ZONE } as const;
  return {
    t: createTranslator({ ...shared, namespace: "email" }),
    tVisit: createTranslator({ ...shared, namespace: "visit" }),
  };
}

function inquiryOf(overrides: Record<string, string> = {}): Inquiry {
  const parsed = parseInquiry(rawSubmission(overrides));
  if (!parsed.ok) throw new Error("fixture does not parse");
  return parsed.inquiry;
}

/** next-intl renders a key it cannot find as `⟦namespace.key⟧` (02 INV-02.5). */
function hasUnresolved(value: string): boolean {
  return value.includes("⟦") || /\{[a-zA-Z]/.test(value);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("the staff notification", () => {
  it("renders every field the doc lists", async () => {
    const { t, tVisit } = await translatorsFor("en");
    const rendered = renderStaffNotification({
      t,
      tVisit,
      locale: "en",
      inquiry: inquiryOf(),
      submittedAt: NOW,
    });

    expect(rendered.subject).toContain("Wei Chen");
    expect(rendered.text).toContain("Wei Chen");
    expect(rendered.text).toContain("wei.chen@example.com");
    // The age band is the label the form shows, not the id on the wire.
    expect(rendered.text).toContain("Toddler (1.5 – 3 years)");
    expect(rendered.text).toContain("As soon as possible");
    expect(rendered.text).toContain("We would love to see the toddler room.");
  });

  it("has a plain-text part and an HTML part carrying the same content", async () => {
    const { t, tVisit } = await translatorsFor("en");
    const rendered = renderStaffNotification({
      t,
      tVisit,
      locale: "en",
      inquiry: inquiryOf(),
      submittedAt: NOW,
    });

    expect(rendered.text.length).toBeGreaterThan(0);
    expect(rendered.html).toContain("<table");
    expect(rendered.html).toContain("Wei Chen");
    expect(rendered.html).toContain("wei.chen@example.com");
  });

  it("omits the optional fields the parent left blank", async () => {
    const { t, tVisit } = await translatorsFor("en");
    const rendered = renderStaffNotification({
      t,
      tVisit,
      locale: "en",
      inquiry: inquiryOf({ desiredStart: "", message: "" }),
      submittedAt: NOW,
    });

    expect(rendered.text).not.toContain("As soon as possible");
    expect(hasUnresolved(rendered.text)).toBe(false);
  });

  it("prints a chosen month with the site's own month format", async () => {
    const { t, tVisit } = await translatorsFor("en");
    const rendered = renderStaffNotification({
      t,
      tVisit,
      locale: "en",
      inquiry: inquiryOf({ desiredStart: "2026-10" }),
      submittedAt: NOW,
    });
    expect(rendered.text).toContain("October 2026");
  });

  it.each([...routing.locales])(
    "prints the preferred-language line as %s's endonym, never the id",
    async (locale) => {
      const { t, tVisit } = await translatorsFor("en");
      const rendered = renderStaffNotification({
        t,
        tVisit,
        locale: "en",
        inquiry: inquiryOf({ locale }),
        submittedAt: NOW,
      });

      expect(rendered.text).toContain(LOCALE_META[locale].nativeName);
      expect(rendered.text).toContain("Preferred language");
    },
  );

  it.each([...routing.locales])("renders with no unresolved placeholder in %s", async (locale) => {
    const { t, tVisit } = await translatorsFor(locale);
    const rendered = renderStaffNotification({
      t,
      tVisit,
      locale,
      inquiry: inquiryOf({ locale }),
      submittedAt: NOW,
    });

    expect(hasUnresolved(rendered.subject)).toBe(false);
    expect(hasUnresolved(rendered.text)).toBe(false);
    expect(hasUnresolved(rendered.html.replace(/\{[^}]*\}/g, ""))).toBe(false);
  });
});

describe("what a parent submits cannot become markup or a header", () => {
  it("escapes every user value in the HTML part", async () => {
    const { t, tVisit } = await translatorsFor("en");
    const rendered = renderStaffNotification({
      t,
      tVisit,
      locale: "en",
      inquiry: inquiryOf({
        parentName: "Wei <b>Chen</b>",
        message: `Tom & Jerry said "hi" <script>alert(1)</script>`,
      }),
      submittedAt: NOW,
    });

    expect(rendered.html).not.toContain("<b>");
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;b&gt;");
    expect(rendered.html).toContain("&amp;");
    expect(rendered.html).toContain("&quot;");
  });

  it("keeps a message's line breaks in both parts", async () => {
    const { t, tVisit } = await translatorsFor("en");
    const rendered = renderStaffNotification({
      t,
      tVisit,
      locale: "en",
      inquiry: inquiryOf({ message: "line one\nline two" }),
      submittedAt: NOW,
    });

    expect(rendered.text).toContain("line one\nline two");
    expect(rendered.html).toContain("line one<br />line two");
  });

  /**
   * 07 §2 step 6 asks that no user text reach a header, while 02's canonical
   * `email.inquiry.subject` is "Tour request from {parentName}". The key wins
   * (02 owns the namespaces, memo ADJ-9) and the risk is closed instead: the
   * subject is a single line whatever the parent typed.
   */
  it("cannot carry an injected header, whatever the name contained", async () => {
    const { t, tVisit } = await translatorsFor("en");
    const rendered = renderStaffNotification({
      t,
      tVisit,
      locale: "en",
      inquiry: inquiryOf({ parentName: "Wei\r\nBcc: victim@example.com" }),
      submittedAt: NOW,
    });

    expect(rendered.subject).not.toContain("\r");
    expect(rendered.subject).not.toContain("\n");
  });

  it("caps a very long name before it reaches the subject", async () => {
    const { t, tVisit } = await translatorsFor("en");
    const rendered = renderStaffNotification({
      t,
      tVisit,
      locale: "en",
      inquiry: inquiryOf({ parentName: "陈".repeat(80) }),
      submittedAt: NOW,
    });
    expect(rendered.subject.length).toBeLessThanOrEqual(120);
  });
});

describe("the parent acknowledgement", () => {
  it.each([...routing.locales])("renders in %s with no unresolved placeholder", async (locale) => {
    const { t } = await translatorsFor(locale);
    const rendered = renderAutoReply({
      t,
      inquiry: inquiryOf({ locale }),
      brandName: "Green Pastures Montessori Daycare",
    });

    expect(hasUnresolved(rendered.subject)).toBe(false);
    expect(hasUnresolved(rendered.text)).toBe(false);
    expect(rendered.text).toContain("Wei Chen");
    expect(rendered.text).toContain("Green Pastures Montessori Daycare");
  });

  it("survives a non-ASCII brand name in both parts", async () => {
    const { t } = await translatorsFor("zh-Hans");
    const rendered = renderAutoReply({
      t,
      inquiry: inquiryOf({ locale: "zh-Hans" }),
      brandName: "优朵幼儿园",
    });

    expect(rendered.text).toContain("优朵幼儿园");
    expect(rendered.html).toContain("优朵幼儿园");
  });

  it("escapes the one value that came from the form", async () => {
    const { t } = await translatorsFor("en");
    const rendered = renderAutoReply({
      t,
      inquiry: inquiryOf({ parentName: "Wei <b>Chen</b>" }),
      brandName: "Green Pastures Montessori Daycare",
    });

    expect(rendered.html).not.toContain("<b>");
    expect(rendered.html).toContain("&lt;b&gt;");
  });

  it("splits the body into paragraphs in the HTML part", async () => {
    const { t } = await translatorsFor("en");
    const rendered = renderAutoReply({
      t,
      inquiry: inquiryOf(),
      brandName: "Green Pastures Montessori Daycare",
    });
    expect(rendered.html.match(/<p /g)?.length).toBeGreaterThan(2);
  });
});
