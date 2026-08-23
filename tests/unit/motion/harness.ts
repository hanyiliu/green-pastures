import { act } from "@testing-library/react";

/**
 * The two browser APIs jsdom does not implement and the motion tree needs
 * (08 §4). Neither is stubbed globally in `tests/unit/setup.ts`, because only
 * these tests want them and a stub in the shared setup would hide a real
 * `IntersectionObserver` bug from every other suite.
 *
 * Not a `*.test.ts` file, so Vitest's `include` never collects it.
 */

type StubEntry = Pick<IntersectionObserverEntry, "target" | "isIntersecting">;

export type IntersectionObserverStub = {
  /** The options of every `new IntersectionObserver(…)` since the stub went in. */
  readonly constructed: readonly IntersectionObserverInit[];
  /** How many elements are currently observed, across every instance. */
  observedCount: () => number;
  /** Drive one element into view, the way a real observer would. */
  enterViewport: (element: Element) => void;
};

/**
 * Install a counting `IntersectionObserver`.
 *
 * Motion pools observers in a module-scope `WeakMap` keyed by the document and
 * the serialised options, so a stub installed per test would be bypassed by the
 * pool from the second test onwards. Install this **once per file**, in
 * `beforeAll`; Vitest gives each file its own module registry, so the pool is
 * fresh anyway.
 */
export function installIntersectionObserverStub(): IntersectionObserverStub {
  const constructed: IntersectionObserverInit[] = [];
  const owners = new Map<Element, StubObserver>();

  class StubObserver {
    readonly callback: IntersectionObserverCallback;
    readonly elements = new Set<Element>();

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback;
      constructed.push(options ?? {});
    }

    observe(element: Element): void {
      this.elements.add(element);
      owners.set(element, this);
    }

    unobserve(element: Element): void {
      this.elements.delete(element);
      owners.delete(element);
    }

    disconnect(): void {
      for (const element of this.elements) owners.delete(element);
      this.elements.clear();
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  globalThis.IntersectionObserver = StubObserver as unknown as typeof IntersectionObserver;

  return {
    constructed,
    observedCount: () => owners.size,
    enterViewport: (element) => {
      const observer = owners.get(element);
      if (observer === undefined) {
        throw new Error("enterViewport: the element is not being observed");
      }
      const entry = { target: element, isIntersecting: true } satisfies StubEntry;
      act(() => {
        observer.callback(
          [entry as IntersectionObserverEntry],
          observer as unknown as IntersectionObserver,
        );
      });
    },
  };
}

/**
 * Install a `matchMedia` that answers `matches` for every query.
 *
 * `Reveal` caches its `MediaQueryList` at module scope (one listener for the
 * whole page), so a file may install this only once and only before its first
 * render.
 */
export function installMatchMedia(matches: boolean): void {
  const query = (media: string): MediaQueryList => ({
    matches,
    media,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });

  window.matchMedia = query;
}
