import { afterEach, describe, expect, it, vi } from "vitest";

import { getSite } from "@/content/site";
import { routing } from "@/i18n/routing";
import {
  autoAcknowledgementEnabled,
  allowedOriginHosts,
  inquiryTransportName,
  recipientsOverride,
} from "@/lib/inquiry/server/env";
import { resolveSendingIdentity } from "@/lib/inquiry/server/identity";

/**
 * The sending identity (07 `D-07.10`, §5; 07 §8 *Handler*: "env override wins;
 * unset falls back to `email.notifyTo` → `contact.email` and to
 * `email.fromAddress`, with the display name from `brand.name[locale]`").
 */

const site = getSite();

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolution order", () => {
  it("reads the addresses from content when nothing is overridden", () => {
    const identity = resolveSendingIdentity("en");
    expect(identity.fromAddress).toBe(site.email.fromAddress);
    expect(identity.to).toStrictEqual([site.contact.email]);
    expect(identity.sendingDomain).toBe(site.email.sendingDomain);
  });

  it("prefers email.notifyTo over contact.email when the owner sets one", () => {
    const withNotifyTo = { ...site, email: { ...site.email, notifyTo: "tours@example.com" } };
    expect(resolveSendingIdentity("en", withNotifyTo).to).toStrictEqual(["tours@example.com"]);
  });

  it("lets INQUIRY_FROM_EMAIL win over the content default", () => {
    vi.stubEnv("INQUIRY_FROM_EMAIL", "onboarding@resend.dev");
    expect(resolveSendingIdentity("en").fromAddress).toBe("onboarding@resend.dev");
  });

  it("lets INQUIRY_TO_EMAIL win, and accepts a comma-separated list", () => {
    vi.stubEnv("INQUIRY_TO_EMAIL", "preview@example.com , second@example.com");
    expect(resolveSendingIdentity("en").to).toStrictEqual([
      "preview@example.com",
      "second@example.com",
    ]);
  });

  it("ignores an override that is only whitespace or commas", () => {
    vi.stubEnv("INQUIRY_TO_EMAIL", " , , ");
    expect(recipientsOverride()).toBeUndefined();
    expect(resolveSendingIdentity("en").to).toStrictEqual([site.contact.email]);
  });

  it("has no environment form for the sending domain at all", () => {
    vi.stubEnv("INQUIRY_FROM_EMAIL", "someone@elsewhere.example");
    expect(resolveSendingIdentity("en").sendingDomain).toBe(site.email.sendingDomain);
  });
});

describe("the display name", () => {
  it.each([...routing.locales])("comes from brand.name[%s], never from env", (locale) => {
    const identity = resolveSendingIdentity(locale);
    expect(identity.displayName).toBe(site.brand.name[locale]);
    expect(identity.from).toContain(identity.displayName);
    expect(identity.from).toContain(`<${identity.fromAddress}>`);
  });

  it("carries the non-ASCII name through unencoded, for the transport to handle", () => {
    expect(resolveSendingIdentity("zh-Hans").from).toContain(site.brand.name["zh-Hans"]);
  });

  it("quotes a display name that contains a quote or a backslash", () => {
    const awkward = {
      ...site,
      brand: { ...site.brand, name: { ...site.brand.name, en: 'Green "Pastures" \\ Daycare' } },
    };
    expect(resolveSendingIdentity("en", awkward).from).toBe(
      `"Green \\"Pastures\\" \\\\ Daycare" <${site.email.fromAddress}>`,
    );
  });
});

describe("the environment this repository ships in", () => {
  it("defaults to the real transport, so preview and production need no variable", () => {
    vi.stubEnv("INQUIRY_TRANSPORT", "");
    expect(inquiryTransportName()).toBe("resend");
  });

  it("switches to the log transport only on an explicit INQUIRY_TRANSPORT=log", () => {
    vi.stubEnv("INQUIRY_TRANSPORT", "log");
    expect(inquiryTransportName()).toBe("log");
    vi.stubEnv("INQUIRY_TRANSPORT", "logging");
    expect(inquiryTransportName()).toBe("resend");
  });

  it("keeps the acknowledgement off unless INQUIRY_AUTOACK is exactly 1", () => {
    expect(autoAcknowledgementEnabled()).toBe(false);
    vi.stubEnv("INQUIRY_AUTOACK", "0");
    expect(autoAcknowledgementEnabled()).toBe(false);
    vi.stubEnv("INQUIRY_AUTOACK", "true");
    expect(autoAcknowledgementEnabled()).toBe(false);
    vi.stubEnv("INQUIRY_AUTOACK", "1");
    expect(autoAcknowledgementEnabled()).toBe(true);
  });

  it("collects the deployment aliases without repeating one", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://greenpasturesdaycare.com");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "greenpasturesdaycare.com");
    vi.stubEnv("VERCEL_URL", "gp-abcdef.vercel.app");
    expect(allowedOriginHosts()).toStrictEqual([
      "greenpasturesdaycare.com",
      "gp-abcdef.vercel.app",
    ]);
  });

  it("names the sending identity paths that still block the release gate", () => {
    // 07 D-07.10: the three samples stay in site.json's provisional registry
    // until Resend verifies the domain, so `--release` fails while they remain.
    expect(site.email.fromAddress.endsWith(`@${site.email.sendingDomain}`)).toBe(true);
  });
});
