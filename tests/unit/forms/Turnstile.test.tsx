import { act, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetTurnstileScriptForTests,
  Turnstile,
  type TurnstileHandle,
} from "@/components/forms/Turnstile";
import { routing } from "@/i18n/routing";
import {
  TURNSTILE_ACTION,
  TURNSTILE_LANGUAGE,
  TURNSTILE_SCRIPT_URL,
} from "@/lib/inquiry/turnstile";

/**
 * The widget wrapper (07 §1, `D-07.7`).
 *
 * jsdom never fetches the script, which is exactly the shape these tests want:
 * the element is what the component controls and the `load` event is what it
 * waits for, so both are driven by hand and the assertions are about *when* the
 * script appears, *what* the widget is rendered with, and what happens when
 * neither ever arrives.
 */

type RenderOptions = {
  sitekey: string;
  action: string;
  language: string;
  appearance: string;
  execution: string;
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
};

const api = {
  render: vi.fn<(container: HTMLElement, options: RenderOptions) => string | undefined>(),
  execute: vi.fn(),
  reset: vi.fn(),
  remove: vi.fn(),
};

let lastOptions: RenderOptions | undefined;

function injectedScript(): HTMLScriptElement | null {
  return document.head.querySelector<HTMLScriptElement>(
    `script[src^="${CSS.escape(TURNSTILE_SCRIPT_URL)}"]`,
  );
}

/** Cloudflare's script arriving: the global appears, then `load` fires. */
async function completeScriptLoad(withApi = true): Promise<void> {
  const script = injectedScript();
  expect(script).not.toBeNull();
  if (withApi) Object.assign(window, { turnstile: api });
  await act(async () => {
    script?.dispatchEvent(new Event("load"));
    await Promise.resolve();
  });
}

beforeEach(() => {
  resetTurnstileScriptForTests();
  lastOptions = undefined;
  api.render.mockReset();
  api.execute.mockReset();
  api.reset.mockReset();
  api.remove.mockReset();
  api.render.mockImplementation((_container, options) => {
    lastOptions = options;
    return "widget-1";
  });
});

afterEach(() => {
  for (const script of document.head.querySelectorAll("script")) script.remove();
  Reflect.deleteProperty(window, "turnstile");
});

describe("the reserved box (07 §1: a challenge never shifts the submit)", () => {
  it("renders a sized container before anything has loaded", () => {
    const { container } = render(
      <Turnstile
        siteKey="site-key"
        locale={routing.defaultLocale}
        onToken={vi.fn()}
        onUnavailable={vi.fn()}
      />,
    );

    const box = container.querySelector("[data-turnstile]");
    expect(box).not.toBeNull();
    // A minimum height, so the invisible `interaction-only` widget has room.
    expect(box?.className).toMatch(/\bmin-h-/u);
  });
});

describe("the script is never in the initial document (07 §1)", () => {
  it("injects nothing until a trigger fires", () => {
    render(
      <Turnstile
        siteKey="site-key"
        locale={routing.defaultLocale}
        onToken={vi.fn()}
        onUnavailable={vi.fn()}
      />,
    );

    expect(injectedScript()).toBeNull();
  });

  it("injects it once the form reports focus", async () => {
    render(
      <Turnstile
        siteKey="site-key"
        locale={routing.defaultLocale}
        armed
        onToken={vi.fn()}
        onUnavailable={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(injectedScript()).not.toBeNull();
    });
    // Explicit rendering, so the language and action stay ours to choose.
    expect(injectedScript()?.src).toContain("render=explicit");
    expect(injectedScript()?.async).toBe(true);
  });

  it("injects it once the box scrolls into view", async () => {
    const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
          observers.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );

    render(
      <Turnstile
        siteKey="site-key"
        locale={routing.defaultLocale}
        onToken={vi.fn()}
        onUnavailable={vi.fn()}
      />,
    );

    expect(injectedScript()).toBeNull();
    act(() => {
      observers[0]?.([{ isIntersecting: true }]);
    });

    await waitFor(() => {
      expect(injectedScript()).not.toBeNull();
    });
    vi.unstubAllGlobals();
  });
});

describe("the widget Cloudflare is asked to render", () => {
  it("carries the site key, the action, the locale's language and the two modes", async () => {
    render(
      <Turnstile
        siteKey="site-key"
        locale="zh-Hans"
        armed
        onToken={vi.fn()}
        onUnavailable={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(injectedScript()).not.toBeNull();
    });
    await completeScriptLoad();

    expect(api.render).toHaveBeenCalledTimes(1);
    expect(lastOptions?.sitekey).toBe("site-key");
    expect(lastOptions?.action).toBe(TURNSTILE_ACTION);
    // The vendor code list is a lookup keyed by locale id, never a comparison.
    expect(lastOptions?.language).toBe(TURNSTILE_LANGUAGE["zh-Hans"]);
    expect(lastOptions?.appearance).toBe("interaction-only");
    expect(lastOptions?.execution).toBe("execute");
  });

  it("hands a solved token up, and re-executes silently when it expires", async () => {
    const onToken = vi.fn();
    render(
      <Turnstile
        siteKey="site-key"
        locale={routing.defaultLocale}
        armed
        onToken={onToken}
        onUnavailable={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(injectedScript()).not.toBeNull();
    });
    await completeScriptLoad();

    act(() => {
      lastOptions?.callback("a-token");
    });
    expect(onToken).toHaveBeenCalledWith("a-token");

    act(() => {
      lastOptions?.["expired-callback"]();
    });
    expect(api.execute).toHaveBeenCalledWith("widget-1");
  });
});

describe("the widget's lifecycle", () => {
  it("resets the widget when Cloudflare reports the challenge timed out", async () => {
    render(
      <Turnstile
        siteKey="site-key"
        locale={routing.defaultLocale}
        armed
        onToken={vi.fn()}
        onUnavailable={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(injectedScript()).not.toBeNull();
    });
    await completeScriptLoad();

    act(() => {
      lastOptions?.["timeout-callback"]();
    });
    expect(api.reset).toHaveBeenCalledWith("widget-1");
  });

  it("removes the widget when it unmounts, so a remount is not a second one", async () => {
    const { unmount } = render(
      <Turnstile
        siteKey="site-key"
        locale={routing.defaultLocale}
        armed
        onToken={vi.fn()}
        onUnavailable={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(injectedScript()).not.toBeNull();
    });
    await completeScriptLoad();

    unmount();
    expect(api.remove).toHaveBeenCalledWith("widget-1");
  });

  it("reports unavailable when Cloudflare declines to render at all", async () => {
    const onUnavailable = vi.fn();
    api.render.mockReturnValue(undefined);

    render(
      <Turnstile
        siteKey="site-key"
        locale={routing.defaultLocale}
        armed
        onToken={vi.fn()}
        onUnavailable={onUnavailable}
      />,
    );
    await waitFor(() => {
      expect(injectedScript()).not.toBeNull();
    });
    await completeScriptLoad();

    expect(onUnavailable).toHaveBeenCalled();
  });
});

describe("it fails loudly, never quietly (07 §2 step 5 fails closed)", () => {
  it("reports unavailable when the script loads without the global", async () => {
    const onUnavailable = vi.fn();
    render(
      <Turnstile
        siteKey="site-key"
        locale={routing.defaultLocale}
        armed
        onToken={vi.fn()}
        onUnavailable={onUnavailable}
      />,
    );
    await waitFor(() => {
      expect(injectedScript()).not.toBeNull();
    });
    await completeScriptLoad(false);

    expect(onUnavailable).toHaveBeenCalled();
  });

  it("reports unavailable when the script itself fails to load", async () => {
    const onUnavailable = vi.fn();
    render(
      <Turnstile
        siteKey="site-key"
        locale={routing.defaultLocale}
        armed
        onToken={vi.fn()}
        onUnavailable={onUnavailable}
      />,
    );
    await waitFor(() => {
      expect(injectedScript()).not.toBeNull();
    });

    await act(async () => {
      injectedScript()?.dispatchEvent(new Event("error"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(onUnavailable).toHaveBeenCalled();
    });
  });

  it("reports unavailable when Cloudflare's own error-callback fires", async () => {
    const onUnavailable = vi.fn();
    render(
      <Turnstile
        siteKey="site-key"
        locale={routing.defaultLocale}
        armed
        onToken={vi.fn()}
        onUnavailable={onUnavailable}
      />,
    );
    await waitFor(() => {
      expect(injectedScript()).not.toBeNull();
    });
    await completeScriptLoad();

    act(() => {
      lastOptions?.["error-callback"]();
    });
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });
});

describe("the handle the form drives it with", () => {
  it("executes the rendered widget, and resets it before a retry", async () => {
    const ref = createRef<TurnstileHandle>();
    render(
      <Turnstile
        ref={ref}
        siteKey="site-key"
        locale={routing.defaultLocale}
        armed
        onToken={vi.fn()}
        onUnavailable={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(injectedScript()).not.toBeNull();
    });
    await completeScriptLoad();

    act(() => {
      ref.current?.execute();
    });
    expect(api.execute).toHaveBeenCalledWith("widget-1");

    act(() => {
      ref.current?.reset();
    });
    expect(api.reset).toHaveBeenCalledWith("widget-1");
  });

  it("arms the load and replays an execute that arrived before the widget existed", async () => {
    const ref = createRef<TurnstileHandle>();
    render(
      <Turnstile
        ref={ref}
        siteKey="site-key"
        locale={routing.defaultLocale}
        onToken={vi.fn()}
        onUnavailable={vi.fn()}
      />,
    );

    expect(injectedScript()).toBeNull();
    act(() => {
      ref.current?.execute();
    });

    await waitFor(() => {
      expect(injectedScript()).not.toBeNull();
    });
    await completeScriptLoad();

    await waitFor(() => {
      expect(api.execute).toHaveBeenCalledWith("widget-1");
    });
  });
});
