"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

import type { Locale } from "@/i18n/routing";
import {
  TURNSTILE_ACTION,
  TURNSTILE_LANGUAGE,
  TURNSTILE_SCRIPT_URL,
} from "@/lib/inquiry/turnstile";

/**
 * The Cloudflare Turnstile widget (04 §3.5, 07 §1, `D-07.7`).
 *
 * Four behaviours, each of which is a requirement rather than a preference.
 *
 * 1. **The script is never in the initial document.** 07 §1: it loads "when the
 *    Visit section enters the viewport or the form receives focus". Both
 *    triggers are here — an `IntersectionObserver` on this component's own
 *    reserved box, and the {@link TurnstileProps.armed} flag the form raises on
 *    its first `focusin`. Whichever fires first wins; neither fires on a page a
 *    parent never scrolls to.
 * 2. **The height is reserved before the widget exists.** `appearance:
 *    "interaction-only"` means the widget is invisible until Cloudflare decides
 *    a challenge is needed — which is precisely when a layout shift would move
 *    the submit button under a parent's finger. The box below is always the
 *    managed widget's own height, so nothing moves when it appears.
 * 3. **The challenge runs on interaction, not on load.** `execution: "execute"`
 *    holds the challenge back until {@link TurnstileHandle.execute} is called,
 *    so the 300-second single-use token is minted when the parent is ready to
 *    submit rather than while they read (07 §1).
 * 4. **It fails loudly, never quietly.** A script that does not load, an
 *    `error-callback`, or a render with no API present all call
 *    {@link TurnstileProps.onUnavailable}; the form turns that into the
 *    `turnstile_unavailable` banner with the direct-contact fallback beside it.
 *    Nothing here ever pretends a token exists.
 *
 * No secret is read: the site key is public and arrives as a prop from the
 * server component that read `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (INV-07.3).
 */

/* -------------------------------------------------------------------------- *
 * Cloudflare's global, as much of it as we use
 * -------------------------------------------------------------------------- */

type TurnstileRenderOptions = {
  readonly sitekey: string;
  readonly action: string;
  readonly language: string;
  readonly appearance: "interaction-only";
  readonly execution: "execute";
  readonly callback: (token: string) => void;
  readonly "error-callback": () => void;
  readonly "expired-callback": () => void;
  readonly "timeout-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

function turnstileApi(): TurnstileApi | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}

/* -------------------------------------------------------------------------- *
 * The script, loaded once per document
 * -------------------------------------------------------------------------- */

/**
 * Explicit rendering: without `render=explicit` Cloudflare scans the document
 * for `.cf-turnstile` elements on load and renders them itself, which would
 * take the language, the action and the execution mode out of our hands.
 */
const SCRIPT_SRC = `${TURNSTILE_SCRIPT_URL}?render=explicit`;

let scriptLoad: Promise<void> | undefined;

function loadTurnstileScript(): Promise<void> {
  if (scriptLoad !== undefined) return scriptLoad;

  scriptLoad = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      resolve();
    });
    script.addEventListener("error", () => {
      // Let a later attempt try again — a failed load is usually a blocked
      // network, and a parent who retries deserves a second request.
      scriptLoad = undefined;
      reject(new Error("turnstile script failed to load"));
    });
    document.head.append(script);
  });

  return scriptLoad;
}

/** Test seam: RTL mounts and unmounts many times in one document. */
export function resetTurnstileScriptForTests(): void {
  scriptLoad = undefined;
}

/* -------------------------------------------------------------------------- *
 * The component
 * -------------------------------------------------------------------------- */

/** What the form can ask the widget to do (07 §1: re-execute before a retry). */
export type TurnstileHandle = {
  /** Run the challenge now, loading the script first if it is not up yet. */
  execute: () => void;
  /** Drop the current token and re-arm — after any failed server attempt. */
  reset: () => void;
};

export type TurnstileProps = {
  readonly siteKey: string;
  readonly locale: Locale;
  readonly onToken: (token: string) => void;
  /** Script blocked, render impossible, or Cloudflare's own `error-callback`. */
  readonly onUnavailable: () => void;
  /** The form raises this on its first `focusin` — 07 §1's second trigger. */
  readonly armed?: boolean;
  readonly ref?: Ref<TurnstileHandle>;
};

/**
 * 65px — the managed widget's height. It is a fixed number rather than a token
 * because it is Cloudflare's measurement, not the design's: 03 mints nothing
 * for a third-party iframe, and `min-h-16.25` is `--spacing × 16.25`, the
 * scale, not an arbitrary value (INV-03.2).
 */
const RESERVED_CLASS = "min-h-16.25 w-full";

export function Turnstile({
  siteKey,
  locale,
  onToken,
  onUnavailable,
  armed = false,
  ref,
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  /** An `execute()` that arrived before the widget existed, replayed on render. */
  const pendingExecuteRef = useRef(false);
  /**
   * The two triggers that are this component's own to observe. `armed` is the
   * third and arrives as a prop, so {@link active} is a derived value rather
   * than a fourth piece of state kept in step with it by an effect.
   */
  const [inView, setInView] = useState(false);
  const [requested, setRequested] = useState(false);
  const active = armed || inView || requested;

  // The callbacks are read through refs so re-rendering the form with a new
  // closure never tears down and re-renders the widget — a re-render would
  // discard a token the parent has already solved for.
  const onTokenRef = useRef(onToken);
  const onUnavailableRef = useRef(onUnavailable);

  useEffect(() => {
    onTokenRef.current = onToken;
    onUnavailableRef.current = onUnavailable;
  });

  /* The viewport trigger. The focus trigger is the `armed` prop, above. */
  useEffect(() => {
    const container = containerRef.current;
    if (active || container === null) return undefined;
    if (typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setInView(true);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [active]);

  /* Load and render, once active. */
  useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;

    void loadTurnstileScript()
      .then(() => {
        const container = containerRef.current;
        const api = turnstileApi();
        if (cancelled || container === null) return;
        if (api === undefined) {
          onUnavailableRef.current();
          return;
        }

        const widgetId = api.render(container, {
          sitekey: siteKey,
          action: TURNSTILE_ACTION,
          language: TURNSTILE_LANGUAGE[locale],
          appearance: "interaction-only",
          execution: "execute",
          callback: (token) => {
            onTokenRef.current(token);
          },
          "error-callback": () => {
            onUnavailableRef.current();
          },
          // 07 §1: "on `expired-callback` the widget re-executes silently".
          "expired-callback": () => {
            const id = widgetIdRef.current;
            if (id !== undefined) turnstileApi()?.execute(id);
          },
          "timeout-callback": () => {
            const id = widgetIdRef.current;
            if (id !== undefined) turnstileApi()?.reset(id);
          },
        });

        if (widgetId === undefined) {
          onUnavailableRef.current();
          return;
        }

        widgetIdRef.current = widgetId;
        if (pendingExecuteRef.current) {
          pendingExecuteRef.current = false;
          api.execute(widgetId);
        }
      })
      .catch(() => {
        if (!cancelled) onUnavailableRef.current();
      });

    return () => {
      cancelled = true;
      const id = widgetIdRef.current;
      if (id !== undefined) {
        turnstileApi()?.remove(id);
        widgetIdRef.current = undefined;
      }
    };
  }, [active, siteKey, locale]);

  useImperativeHandle(
    ref,
    () => ({
      execute() {
        const id = widgetIdRef.current;
        const api = turnstileApi();
        if (id !== undefined && api !== undefined) {
          api.execute(id);
          return;
        }
        // Not up yet: arm the load and replay the execute when it renders.
        pendingExecuteRef.current = true;
        setRequested(true);
      },
      reset() {
        const id = widgetIdRef.current;
        if (id !== undefined) turnstileApi()?.reset(id);
      },
    }),
    [],
  );

  return <div ref={containerRef} className={RESERVED_CLASS} data-turnstile="inquiry" />;
}
