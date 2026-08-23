import { IntlError, IntlErrorCode } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formats, TIME_ZONE } from "@/i18n/formats";
import {
  assembleLocaleTree,
  CLIENT_NAMESPACES,
  clientMessages,
  COLLECTION_NAMESPACES,
  loadMessages,
  MESSAGE_NAMESPACES,
  reference,
  type LoadedFile,
} from "@/i18n/messages";
import { ACCEPT_LANGUAGE, LOCALE_META, routing } from "@/i18n/routing";

/**
 * The i18n runtime (02 `D-02.1`, `D-02.6`, `D-02.7`, `D-02.8`, `D-02.16`).
 *
 * `next/root-params` is a compiler placeholder that throws when imported
 * outside a Next build, and `next-intl/server`'s client shim replaces
 * `getRequestConfig` with a thrower — both are stubbed so the request config
 * itself can be exercised as a plain function.
 */
const rootParams = vi.hoisted(() => ({ locale: undefined as string | undefined }));

vi.mock("next/root-params", () => ({
  locale: () => Promise.resolve(rootParams.locale),
}));

vi.mock("next-intl/server", () => ({
  getRequestConfig: (create: unknown) => create,
}));

type RequestConfigParams = { locale?: string; requestLocale: Promise<string | undefined> };
type RequestConfig = {
  locale: string;
  messages: unknown;
  timeZone: string;
  formats: unknown;
  onError: (error: IntlError) => void;
  getMessageFallback: (info: { error: IntlError; key: string; namespace?: string }) => string;
};

async function requestConfig(params: RequestConfigParams): Promise<RequestConfig> {
  const module = await import("@/i18n/request");
  const create = module.default as unknown as (
    params: RequestConfigParams,
  ) => Promise<RequestConfig>;
  return create(params);
}

function intlError(code: IntlErrorCode, message: string): IntlError {
  return new IntlError(code, message);
}

function silenceConsoleError() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

let consoleError: ReturnType<typeof silenceConsoleError>;

beforeEach(() => {
  rootParams.locale = undefined;
  consoleError = silenceConsoleError();
});

afterEach(() => {
  consoleError.mockRestore();
  vi.resetModules();
});

describe("LOCALE_META (02 D-02.1)", () => {
  it("has one row per enabled locale and no others", () => {
    expect(Object.keys(LOCALE_META)).toStrictEqual([...routing.locales]);
  });

  it("uses the locale id verbatim as htmlLang and hreflang", () => {
    for (const id of routing.locales) {
      expect(LOCALE_META[id].htmlLang).toBe(id);
      expect(LOCALE_META[id].hreflang).toBe(id);
    }
  });

  it("carries the switcher's endonyms and short labels as data, not messages", () => {
    expect(LOCALE_META.en.nativeName).toBe("English");
    expect(LOCALE_META.en.shortLabel).toBe("EN");
    expect(LOCALE_META["zh-Hans"].nativeName).toBe("简体中文");
    expect(LOCALE_META["zh-Hans"].shortLabel).toBe("简");
  });

  it("pairs each locale with an enabled brand-name partner (D-02.19)", () => {
    for (const id of routing.locales) {
      expect(routing.locales).toContain(LOCALE_META[id].brandPairLocale);
    }
  });

  it("never names the retired bare `zh` identifier", () => {
    const table = JSON.stringify({ locales: routing.locales, meta: LOCALE_META });
    expect(table).not.toMatch(/"zh"/);
  });
});

describe("ACCEPT_LANGUAGE preference chains (D-06.15(a))", () => {
  it("names only ids from the catalogue and keeps zh-Hant as a preference", () => {
    const chains = ACCEPT_LANGUAGE.map(([, preference]) => [...preference]);
    expect(chains).toStrictEqual([["zh-Hans", "zh-Hant"], ["zh-Hant", "zh-Hans"], ["en"]]);
  });
});

describe("formats (02 D-02.6)", () => {
  it("declares every named format the contract references", () => {
    expect(Object.keys(formats.number)).toStrictEqual(["rating"]);
    expect(Object.keys(formats.dateTime)).toStrictEqual([
      "timeShort",
      "weekdayShort",
      "weekdayLong",
      "dateMonth",
    ]);
  });

  it("renders a whole rating with one fraction digit", () => {
    expect(new Intl.NumberFormat("en", formats.number.rating).format(5)).toBe("5.0");
  });

  it("pins the time zone so server and client agree on today", () => {
    expect(TIME_ZONE).toBe("America/Los_Angeles");
  });
});

describe("loadMessages (02 D-02.7, D-02.8)", () => {
  it("returns the statically imported en tree for the reference locale", async () => {
    await expect(loadMessages("en")).resolves.toBe(reference);
  });

  it("exposes every en namespace plus the collections namespace", () => {
    expect(Object.keys(reference).sort()).toStrictEqual(
      [...MESSAGE_NAMESPACES, "collections"].sort(),
    );
    expect(Object.keys(reference.collections).sort()).toStrictEqual([...COLLECTION_NAMESPACES]);
  });

  it("loads every zh-Hans file silently now that PR-3.5 has authored the tree", async () => {
    const messages = await loadMessages("zh-Hans");

    expect(Object.keys(messages).sort()).toStrictEqual(
      [...MESSAGE_NAMESPACES, "collections"].sort(),
    );
    expect(Object.keys(messages.collections).sort()).toStrictEqual([...COLLECTION_NAMESPACES]);
    // Nothing is *missing*: the untranslated namespaces are authored as `{}`,
    // which is the phase state (INV-02.11), not an editing mistake.
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("leaves an untranslated namespace empty in dev rather than filling it from en", async () => {
    const messages = await loadMessages("zh-Hans");

    expect(messages.common.nav.bookTour).toBe("预约参观");
    // An untranslated sibling is absent, not English — dev has no fallback, so
    // it renders `getMessageFallback`'s marker and the gap is seen (D-02.8).
    expect(messages.common).not.toHaveProperty("footer");
    expect(Object.keys(messages.email)).toStrictEqual([]);
    expect(Object.keys(messages.collections.teachers)).toStrictEqual([]);
  });

  it("renders en for that same gap in prod, which is what the site serves today", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const messages = await loadMessages("zh-Hans");

      expect(messages.common.nav.bookTour).toBe("预约参观");
      expect(messages.common.footer).toStrictEqual(reference.common.footer);
      expect(messages.email).toStrictEqual(reference.email);
      expect(messages.collections.teachers).toStrictEqual(reference.collections.teachers);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("assembleLocaleTree (02 D-02.8)", () => {
  const file = (namespace: string, messages: Record<string, unknown> | undefined): LoadedFile => ({
    path: `content/zh-Hans/messages/${namespace}.json`,
    namespace,
    messages,
  });

  it("throws in dev when one file is missing from an otherwise present tree", () => {
    expect(() =>
      assembleLocaleTree(
        [file("common", { nav: { bookTour: "预约参观" } }), file("home", undefined)],
        [],
        { production: false },
      ),
    ).toThrow("content/zh-Hans/messages/home.json");
  });

  it("counts an authored-but-empty file as present, not missing", () => {
    // `{}` is how an untranslated namespace is spelled while a locale is being
    // filled; it must not trip the missing-file throw above, or the dev server
    // would die on exactly the state `content/zh-Hans/` is in today.
    expect(() =>
      assembleLocaleTree(
        [file("common", { nav: { bookTour: "预约参观" } }), file("email", {})],
        [],
        {
          production: false,
        },
      ),
    ).not.toThrow();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("does not throw in dev when not one file of the tree loads (the add-a-locale window)", () => {
    // The carve-out is per locale, so it retires itself: for `zh-Hans` the day
    // PR-3.5 landed, and for `zh-Hant` the day PR-3.9 copied the tree across.
    // It is what keeps a locale serving between steps 1 and 3 of 02's
    // add-a-locale checklist — the id enabled, the directory not yet there —
    // which is the window this PR passed through and the next locale will too.
    // The paths below are `zh-Hant`'s because that is the window this case was
    // written for; nothing here reads the real tree.
    const absent = (directory: "messages" | "collections", namespace: string): LoadedFile => ({
      path: `content/zh-Hant/${directory}/${namespace}.json`,
      namespace,
      messages: undefined,
    });
    const tree: Record<string, unknown> = assembleLocaleTree(
      MESSAGE_NAMESPACES.map((namespace) => absent("messages", namespace)),
      COLLECTION_NAMESPACES.map((namespace) => absent("collections", namespace)),
      { production: false },
    );

    expect(Object.keys(tree)).toStrictEqual(["collections"]);
    expect(tree.collections).toStrictEqual({});
    expect(consoleError).toHaveBeenCalledTimes(
      MESSAGE_NAMESPACES.length + COLLECTION_NAMESPACES.length,
    );
    expect(String(consoleError.mock.calls[0]?.[0])).toContain(
      "content/zh-Hant/messages/common.json",
    );
  });

  it("does not fall back to en in dev, so gaps render as markers", () => {
    const tree = assembleLocaleTree([file("common", { nav: { bookTour: "预约参观" } })], [], {
      production: false,
    });
    expect(Object.keys(tree)).toStrictEqual(["common", "collections"]);
  });

  it("deep-merges the locale over en in prod so a gap renders English", () => {
    const tree: Record<string, unknown> = assembleLocaleTree(
      [file("common", { nav: { bookTour: "预约参观" } })],
      [],
      { production: true },
    );

    const common = tree.common as { nav: Record<string, string>; back: Record<string, string> };
    expect(common.nav.bookTour).toBe("预约参观");
    // Untranslated siblings survive the merge rather than disappearing.
    expect(common.nav.philosophy).toBe(reference.common.nav.philosophy);
    expect(common.back.label).toBe(reference.common.back.label);
    expect(tree.home).toStrictEqual(reference.home);
  });

  it("never throws in prod, however much is missing", () => {
    expect(() =>
      assembleLocaleTree([file("common", undefined)], [], { production: true }),
    ).not.toThrow();
  });
});

describe("clientMessages (02 D-02.16)", () => {
  it("hands a client subtree only the namespaces D-02.16 names", () => {
    const picked = clientMessages(reference);
    expect(Object.keys(picked).sort()).toStrictEqual([...CLIENT_NAMESPACES].sort());
  });

  it("never ships collections wholesale", () => {
    expect(clientMessages(reference)).not.toHaveProperty("collections");
    expect(CLIENT_NAMESPACES).not.toContain("menu");
  });

  it("skips a namespace the tree does not carry rather than sending undefined", () => {
    const partial = { common: reference.common } as unknown as typeof reference;
    expect(Object.keys(clientMessages(partial))).toStrictEqual(["common"]);
  });
});

describe("request config (02 D-02.7, D-02.8)", () => {
  it("uses an explicitly passed locale (the Route Handler path)", async () => {
    const config = await requestConfig({
      locale: "zh-Hans",
      requestLocale: Promise.resolve(undefined),
    });
    expect(config.locale).toBe("zh-Hans");
  });

  it("reads the [locale] root param without touching headers (06 D-06.4)", async () => {
    rootParams.locale = "zh-Hans";
    const config = await requestConfig({
      // next-intl exposes `requestLocale` as a lazy getter that reads
      // `headers()`; a static render must never reach it.
      get requestLocale(): Promise<string | undefined> {
        throw new Error("headers() must not be read during static rendering");
      },
    });
    expect(config.locale).toBe("zh-Hans");
  });

  it("falls back to requestLocale when no root param is available", async () => {
    const config = await requestConfig({ requestLocale: Promise.resolve("zh-Hans") });
    expect(config.locale).toBe("zh-Hans");
  });

  it("falls back to the default locale for an unknown value", async () => {
    const config = await requestConfig({ requestLocale: Promise.resolve("fr") });
    expect(config.locale).toBe(routing.defaultLocale);
  });

  it("pins the time zone and the named formats", async () => {
    const config = await requestConfig({ requestLocale: Promise.resolve("en") });
    expect(config.timeZone).toBe(TIME_ZONE);
    expect(config.formats).toStrictEqual(formats);
  });

  it("renders ⟦namespace.key⟧ for a key missing from en too (INV-02.8)", async () => {
    const config = await requestConfig({ requestLocale: Promise.resolve("en") });
    const error = intlError(IntlErrorCode.MISSING_MESSAGE, "nope");

    expect(config.getMessageFallback({ error, namespace: "common", key: "nope" })).toBe(
      "⟦common.nope⟧",
    );
    expect(config.getMessageFallback({ error, key: "nope" })).toBe("⟦nope⟧");
    expect(config.getMessageFallback({ error, namespace: "common", key: "nope" })).not.toBe("");
  });

  it("logs a missing message once per key and rethrows anything else", async () => {
    const config = await requestConfig({ requestLocale: Promise.resolve("en") });
    consoleError.mockClear();

    const missing = intlError(IntlErrorCode.MISSING_MESSAGE, "common.nope");
    config.onError(missing);
    config.onError(missing);
    expect(consoleError).toHaveBeenCalledTimes(1);

    expect(() => {
      config.onError(intlError(IntlErrorCode.INVALID_MESSAGE, "broken"));
    }).toThrow(IntlError);
  });

  it("still de-duplicates when the error carries no original message", async () => {
    const config = await requestConfig({ requestLocale: Promise.resolve("en") });
    consoleError.mockClear();

    config.onError(new IntlError(IntlErrorCode.MISSING_MESSAGE));
    config.onError(new IntlError(IntlErrorCode.MISSING_MESSAGE));
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
