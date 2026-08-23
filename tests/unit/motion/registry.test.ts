import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cascadeIndexFor,
  hasRevealed,
  isLocaleSwapping,
  LOCALE_SWAP_WINDOW_MS,
  markLocaleSwap,
  markRevealed,
  resetRevealRegistry,
  revealedIds,
} from "@/components/motion/registry";

/**
 * The session registry (05 `D-05.6`, §5.6).
 *
 * These are the module-scope guarantees `Reveal` leans on: an id, once
 * recorded, stays recorded for the life of the session — which is what makes a
 * reveal survive a client navigation without replaying — and the locale-swap
 * mark opens a bounded window with a stable per-id mount order inside it.
 */

beforeEach(() => {
  resetRevealRegistry();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("revealed ids", () => {
  it("starts empty and remembers what it is told", () => {
    expect(hasRevealed("programs.header")).toBe(false);

    markRevealed("programs.header");

    expect(hasRevealed("programs.header")).toBe(true);
    expect(revealedIds.has("programs.header")).toBe(true);
  });

  it("is idempotent — a second reveal of the same id adds nothing", () => {
    markRevealed("menu.plate");
    markRevealed("menu.plate");

    expect(revealedIds.size).toBe(1);
  });

  it("keeps ids apart", () => {
    markRevealed("gallery.header");

    expect(hasRevealed("teachers.header")).toBe(false);
  });
});

describe("the locale-swap window", () => {
  it("is closed until the switcher marks it", () => {
    expect(isLocaleSwapping()).toBe(false);
  });

  it("opens on the mark and closes after the window", () => {
    vi.useFakeTimers();

    markLocaleSwap();
    expect(isLocaleSwapping()).toBe(true);

    vi.advanceTimersByTime(LOCALE_SWAP_WINDOW_MS - 1);
    expect(isLocaleSwapping()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(isLocaleSwapping()).toBe(false);
  });

  it("does not forget which reveals have played — the new tree still knows", () => {
    markRevealed("hero.text");
    markLocaleSwap();

    expect(hasRevealed("hero.text")).toBe(true);
  });
});

describe("the cascade order", () => {
  it("numbers ids from zero in the order they ask", () => {
    markLocaleSwap();

    expect(cascadeIndexFor("common.nav")).toBe(0);
    expect(cascadeIndexFor("hero.text")).toBe(1);
    expect(cascadeIndexFor("philosophy.quote")).toBe(2);
  });

  it("gives one id the same answer every time it asks", () => {
    markLocaleSwap();

    expect(cascadeIndexFor("hero.text")).toBe(0);
    expect(cascadeIndexFor("philosophy.quote")).toBe(1);
    expect(cascadeIndexFor("hero.text")).toBe(0);
  });

  it("restarts at zero on the next swap", () => {
    markLocaleSwap();
    cascadeIndexFor("common.nav");
    cascadeIndexFor("hero.text");

    markLocaleSwap();

    expect(cascadeIndexFor("hero.text")).toBe(0);
  });
});
