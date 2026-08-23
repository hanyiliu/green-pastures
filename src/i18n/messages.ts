import faqCollection from "../../content/en/collections/faq.json";
import galleryCollection from "../../content/en/collections/gallery.json";
import menuCollection from "../../content/en/collections/menu.json";
import programsCollection from "../../content/en/collections/programs.json";
import teachersCollection from "../../content/en/collections/teachers.json";
import testimonialsCollection from "../../content/en/collections/testimonials.json";
import common from "../../content/en/messages/common.json";
import email from "../../content/en/messages/email.json";
import errors from "../../content/en/messages/errors.json";
import faq from "../../content/en/messages/faq.json";
import gallery from "../../content/en/messages/gallery.json";
import home from "../../content/en/messages/home.json";
import menu from "../../content/en/messages/menu.json";
import philosophy from "../../content/en/messages/philosophy.json";
import programs from "../../content/en/messages/programs.json";
import reviews from "../../content/en/messages/reviews.json";
import team from "../../content/en/messages/team.json";
import visit from "../../content/en/messages/visit.json";

import { routing, type Locale } from "./routing";

/**
 * Message loading and typing (02 `D-02.7`, `D-02.8`).
 *
 * `en` is the **reference locale**: every `content/en/**` file is imported
 * statically here, and the resulting object is both the namespace list and the
 * source of the `Messages` type (`global.d.ts` feeds it to next-intl's
 * `AppConfig`). Other locales are loaded per namespace by dynamic import.
 *
 * Collections live in the same tree under the `collections` namespace, so
 * `t("collections.teachers.reyes.name")` addresses them like any other message
 * while `src/content/` (PR-3.3) owns their Zod schemas and the join with the
 * shared ids in `content/site.json`.
 *
 * Adding a namespace is one import plus one entry in `MESSAGE_NAMESPACES` or
 * `COLLECTION_NAMESPACES`; nothing else in this file changes.
 */

const referenceMessages = {
  common,
  email,
  errors,
  faq,
  gallery,
  home,
  menu,
  philosophy,
  programs,
  reviews,
  team,
  visit,
} as const;

const referenceCollections = {
  faq: faqCollection,
  gallery: galleryCollection,
  menu: menuCollection,
  programs: programsCollection,
  teachers: teachersCollection,
  testimonials: testimonialsCollection,
} as const;

/**
 * The `en` tree. Its shape *is* the contract: `Messages` is `typeof reference`,
 * so `t("common.nope")` is a compile-time error.
 */
export const reference = {
  ...referenceMessages,
  collections: referenceCollections,
} as const;

/** The reference tree's type — `AppConfig['Messages']` (02 `D-02.7`). */
export type Messages = typeof reference;

/** Every message namespace, derived from the `en` tree (02 `D-02.4`). */
export const MESSAGE_NAMESPACES = [
  "common",
  "email",
  "errors",
  "faq",
  "gallery",
  "home",
  "menu",
  "philosophy",
  "programs",
  "reviews",
  "team",
  "visit",
] as const satisfies ReadonlyArray<keyof typeof referenceMessages>;

/** Every collection, derived from the `en` tree (02 `D-02.11`). */
export const COLLECTION_NAMESPACES = [
  "faq",
  "gallery",
  "menu",
  "programs",
  "teachers",
  "testimonials",
] as const satisfies ReadonlyArray<keyof typeof referenceCollections>;

export type MessageNamespace = (typeof MESSAGE_NAMESPACES)[number];
export type CollectionNamespace = (typeof COLLECTION_NAMESPACES)[number];

/**
 * The namespaces a client subtree may receive (02 `D-02.16`).
 *
 * Server components render by default; `NextIntlClientProvider` hands the
 * browser only what a client component actually reads — `Reveal`'s swap
 * variant, `CountUp`, the inquiry form, the locale switcher, the gallery
 * filters and lightbox, the hamburger, and the route error boundary Next.js
 * requires to be a client component — and never `collections.*` wholesale. The
 * menu's sample lines and day chips are pre-rendered on the server and handed
 * to `WordSwap` as props, which is why `menu` is absent here.
 */
export const CLIENT_NAMESPACES = [
  "common",
  "visit",
  "gallery",
  "errors",
] as const satisfies ReadonlyArray<MessageNamespace>;

export type ClientNamespace = (typeof CLIENT_NAMESPACES)[number];

type MessageTree = Record<string, unknown>;

function isTree(value: unknown): value is MessageTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep-merge `override` over `base`; arrays and strings are replaced whole. */
function deepMerge(base: MessageTree, override: MessageTree): MessageTree {
  const merged: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = merged[key];
    merged[key] = isTree(existing) && isTree(value) ? deepMerge(existing, value) : value;
  }
  return merged;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** One content file's load result — `messages` is `undefined` when it is absent. */
export type LoadedFile = {
  readonly path: string;
  readonly namespace: string;
  readonly messages: MessageTree | undefined;
};

async function importFile(
  locale: Locale,
  directory: "messages" | "collections",
  namespace: string,
): Promise<LoadedFile> {
  const path = `content/${locale}/${directory}/${namespace}.json`;
  try {
    const loaded: unknown = await import(`../../content/${locale}/${directory}/${namespace}.json`);
    const messages = isTree(loaded) ? loaded.default : undefined;
    return { path, namespace, messages: isTree(messages) ? messages : undefined };
  } catch {
    return { path, namespace, messages: undefined };
  }
}

function missingFileMessage(file: LoadedFile): string {
  return (
    `[i18n] Missing message file ${file.path} — copy the matching file from ` +
    `content/${routing.defaultLocale}/ and translate it (02 D-02.8).`
  );
}

function collect(files: ReadonlyArray<LoadedFile>): MessageTree {
  const tree: MessageTree = {};
  for (const file of files) {
    if (file.messages !== undefined) tree[file.namespace] = file.messages;
  }
  return tree;
}

/**
 * Turn one locale's loaded files into its message tree (02 `D-02.8`).
 *
 * - **prod** — the locale's tree is deep-merged over `en`, so a key that
 *   slipped past CI renders English instead of nothing, and the gap is logged.
 *   Defence in depth only: `pnpm validate:content` is the real gate.
 * - **dev** — no fallback, so gaps are seen while editing: a missing key
 *   renders `getMessageFallback`'s `⟦namespace.key⟧` marker. A file that is
 *   missing from an *otherwise present* locale tree throws, naming the path to
 *   copy from `en` — an editor deleted or forgot a file.
 * - The one carve-out: a locale whose tree does not exist **at all** (not one
 *   file loads) is the phased-translation window, not an editing mistake —
 *   `content/zh-Hans/` arrives at PR-3.5 and `content/zh-Hant/` at PR-3.9. That
 *   case logs the same per-file error and renders markers, so `/zh-Hans` still
 *   serves with the right `<html lang>` instead of 500ing for several PRs. The
 *   carve-out lapses the moment the tree exists.
 *
 * Exported so the branch table above can be tested without a content fixture
 * for a locale another PR owns.
 */
export function assembleLocaleTree(
  messageFiles: ReadonlyArray<LoadedFile>,
  collectionFiles: ReadonlyArray<LoadedFile>,
  options: { readonly production: boolean },
): Messages {
  const files = [...messageFiles, ...collectionFiles];
  const missing = files.filter((file) => file.messages === undefined);

  for (const file of missing) {
    console.error(missingFileMessage(file));
  }

  const firstMissing = missing[0];
  if (firstMissing !== undefined && missing.length < files.length && !options.production) {
    throw new Error(missingFileMessage(firstMissing));
  }

  const tree: MessageTree = {
    ...collect(messageFiles),
    collections: collect(collectionFiles),
  };

  return (options.production ? deepMerge(reference, tree) : tree) as Messages;
}

/**
 * Load the messages for one locale (02 `D-02.7`). `en` is the static tree,
 * always complete; every other locale is read from its own files and assembled
 * by `assembleLocaleTree`.
 */
export async function loadMessages(locale: Locale): Promise<Messages> {
  if (locale === routing.defaultLocale) return reference;

  const [messageFiles, collectionFiles] = await Promise.all([
    Promise.all(MESSAGE_NAMESPACES.map((namespace) => importFile(locale, "messages", namespace))),
    Promise.all(
      COLLECTION_NAMESPACES.map((namespace) => importFile(locale, "collections", namespace)),
    ),
  ]);

  return assembleLocaleTree(messageFiles, collectionFiles, { production: isProduction() });
}

/**
 * Narrow a full message tree to the namespaces a client subtree may receive
 * (02 `D-02.16`). The `[locale]` layout passes the result to
 * `NextIntlClientProvider`.
 */
export function clientMessages(messages: Messages): Pick<Messages, ClientNamespace> {
  const picked: MessageTree = {};
  for (const namespace of CLIENT_NAMESPACES) {
    if (namespace in messages) picked[namespace] = messages[namespace];
  }
  return picked as Pick<Messages, ClientNamespace>;
}
