import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import { HeroSection } from "@/components/sections/hero/HeroSection";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { reference } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

import { installIntersectionObserverStub } from "../../motion/harness";

/**
 * What the hero does when `content/site.json` is not the file it is today
 * (02 `D-02.12`, INV-04.11).
 *
 * Two fields drive this section and they are not the same kind of thing. The
 * **Yelp block is optional in the schema**, so dropping it has to leave a
 * working hero — the age range keeps its place and the row simply loses its
 * rating half. The **philosophy route is not optional**: both hero links and
 * the scroll cue resolve their anchor through it, so its absence is a config
 * error and has to fail loudly, at build time, naming the file to fix — the
 * same contract `LearnMoreLink` keeps.
 *
 * A separate file from `HeroSection.test.tsx` because `vi.mock` is hoisted per
 * module: the config seam has to be installed before the component tree is
 * imported, and the suite next door wants the real file.
 */

const config = vi.hoisted(() => ({ dropYelp: false, dropPhilosophyRoute: false }));

vi.mock("@/i18n/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/navigation")>();
  return { ...actual, usePathname: () => "/" };
});

vi.mock("@/content/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/content/site")>();
  return {
    ...actual,
    getSite: () => {
      const site = actual.getSite();
      return {
        ...site,
        yelp: config.dropYelp ? undefined : site.yelp,
        routes: config.dropPhilosophyRoute
          ? site.routes.filter((route) => route.id !== "philosophy")
          : site.routes,
      };
    },
  };
});

beforeAll(() => {
  installIntersectionObserverStub();
});

beforeEach(() => {
  config.dropYelp = false;
  config.dropPhilosophyRoute = false;
  resetRevealRegistry();
});

function renderHero() {
  return render(
    <NextIntlClientProvider
      locale={routing.defaultLocale}
      messages={reference}
      formats={formats}
      timeZone={TIME_ZONE}
    >
      <MotionProvider>
        <HeroSection />
      </MotionProvider>
    </NextIntlClientProvider>,
  );
}

describe("site.yelp is optional", () => {
  it("drops the rating half and keeps the age range when the config carries no Yelp", () => {
    config.dropYelp = true;
    const { container } = renderHero();

    expect(screen.queryByRole("img", { name: /yelp/iu })).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("★");
    expect(screen.getByText(reference.home.hero.trust.ages)).toBeInTheDocument();
  });
});

describe("the philosophy route is not optional", () => {
  it("fails with the file to fix rather than rendering a link to nowhere", () => {
    config.dropPhilosophyRoute = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => renderHero()).toThrow(/content\/site\.json/u);
  });
});
