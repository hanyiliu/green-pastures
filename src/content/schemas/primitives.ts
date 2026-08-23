import { z } from "zod";

import { routing } from "@/i18n/routing";

/**
 * The vocabulary every content schema is built from (02 `D-02.7`, INV-02.3).
 *
 * 02 splits content in two: **per-locale text**, which lives in
 * `content/<locale>/…` and is the only thing a translator touches, and
 * **locale-agnostic data** — ids, order, numbers, paths, flags — which lives
 * once in `content/site.json` (`D-02.3`, `D-02.12`). That split is the reason
 * this file exists: `Text` / `RichText` are the text side, everything below
 * them is the data side, and a schema that reaches for the wrong one is
 * visibly wrong at the call site.
 *
 * The seven schema modules beside this one each own one file's shape;
 * `site.ts` composes the `*Shared` halves into `content/site.json`. Shared
 * primitives sit here rather than in `site.ts` so that `site.ts` can import
 * the collections without the collections importing it back.
 */

/* -------------------------------------------------------------------------- *
 * Text
 * -------------------------------------------------------------------------- */

/**
 * Any tag-shaped token. Used to keep HTML out of JSON values (02 `D-02.5`,
 * INV-02.8) — markup is expressed with the ICU rich-tag allowlist and rendered
 * by `t.rich`, never stored.
 */
const TAG_TOKEN = /<\/?[A-Za-z][^>]*>/;

/**
 * The same pattern, global, for collecting every tag in a rich value — derived
 * from {@link TAG_TOKEN} rather than typed out again, so "tag-shaped" has one
 * spelling in this file and the two cannot disagree about what a tag is.
 */
const ALL_TAG_TOKENS = new RegExp(TAG_TOKEN.source, "g");

/**
 * 02 `D-02.5`'s closed tag allowlist, as the exact tokens a value may contain.
 * Attributes are absent on purpose: `<link>` takes its href from the ICU
 * argument at the call site, not from the string.
 */
const RICH_TAG_TOKEN = /^<\/?(?:em|strong|link|count|day)>$/;

/**
 * Every tag-shaped token in `value`, in the order it appears.
 *
 * Exported, with {@link isRichTagToken}, because `scripts/validate-content.ts`
 * splits the same two kinds of token out of an ICU message (08 §3,
 * `html-in-value`) and used to do it with its own copy of both patterns. The
 * schema decides what `next build` accepts and the validator decides what the
 * PR gate accepts; a tag the two classified differently would be one gate green
 * and the other red on the same string, so they classify through one function.
 */
export function tagTokensIn(value: string): readonly string[] {
  // `String.prototype.match` with a global pattern resets `lastIndex` itself,
  // so the shared regex carries no state between callers.
  return value.match(ALL_TAG_TOKENS) ?? [];
}

/** Is `token` one of 02 `D-02.5`'s rich tags — `<em>`, `</link>`, `<count>`? */
export function isRichTagToken(token: string): boolean {
  return RICH_TAG_TOKEN.test(token);
}

const NO_HTML_MESSAGE =
  "HTML is not allowed in a content value (02 D-02.5, INV-02.8) — " +
  "use the rich-tag allowlist <em>, <strong>, <link>, <count>, <day> in a rich field.";

const RICH_TAG_MESSAGE =
  "Only the rich tags <em>, <strong>, <link>, <count> and <day> are allowed (02 D-02.5).";

/**
 * A plain, non-empty, trimmed content string with no markup at all.
 *
 * The trim is a transform, so the parsed value is what renders: a stray
 * trailing space in a JSON edit cannot reach a page. Empty (and
 * whitespace-only) values are invalid everywhere (02 `D-02.8`, INV-02.8) —
 * a missing string must be a missing *key*, so the `⟦…⟧` marker fires and
 * `validate:content` can see it.
 */
export const Text = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !TAG_TOKEN.test(value), { error: NO_HTML_MESSAGE });

/**
 * A content string that may carry the ICU rich tags of 02 `D-02.5` — the
 * testimonial quotes (`The teachers truly <em>see</em> her`) and, once the FAQ
 * ships, its answers. Any other tag is rejected exactly as in {@link Text}.
 */
export const RichText = z
  .string()
  .trim()
  .min(1)
  .refine((value) => tagTokensIn(value).every(isRichTagToken), {
    error: RICH_TAG_MESSAGE,
  });

/* -------------------------------------------------------------------------- *
 * Localized values (02 D-02.19)
 * -------------------------------------------------------------------------- */

/**
 * A value that genuinely reads differently per language but is still *data*,
 * not copy: `brand.name` and `brand.shortName` (02 `D-02.19`, `D-02.12`).
 *
 * The key schema is `routing.locales`, and Zod 4 records over an enum are
 * **exhaustive** — so this single line is INV-02.3's "every localized value has
 * an entry for every id in `routing.locales` and no others": a missing locale
 * is a parse error, and a locale that is not enabled is an unrecognised key.
 * Enabling a locale in `routing.ts` therefore *breaks the build* until its brand
 * names are authored — which is the point, and is what PR-3.9 walked into on
 * `zh-Hant`. The rule bites in both directions: withdrawing an id under D-10.12
 * takes its brand names out with it.
 */
export const LocalizedText = z.record(z.enum(routing.locales), Text);
export type LocalizedText = z.infer<typeof LocalizedText>;

/* -------------------------------------------------------------------------- *
 * Identifiers and paths
 * -------------------------------------------------------------------------- */

/**
 * A locale-agnostic id: the join key between `content/site.json` and the
 * per-locale collection files, and never rendered (02 `D-02.11`, key-naming
 * rule 2's camelCase, applied to data). `meiL`, `followTheChild`, `g01`.
 */
export const Id = z.string().regex(/^[a-z][A-Za-z0-9]*$/, {
  error: "An id is camelCase and starts with a lower-case letter (02 D-02.11).",
});

/** A file under `public/`: `/images/team/ping.jpg`, `/og/cover.png`. */
export const AssetPath = z.string().regex(/^\/[A-Za-z0-9][A-Za-z0-9/_-]*\.[a-z0-9]{2,4}$/, {
  error: "An asset path is rooted at public/, e.g. /images/hero.jpg (02 INV-02.3).",
});

/** A route path as `site.json.routes[]` declares it: `/philosophy`. */
export const RoutePath = z.string().regex(/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  error: "A route path is a single lower-case segment, e.g. /philosophy (02 D-02.12).",
});

/** An internal href, which may carry a fragment: `/#visit`. */
export const InternalHref = z.string().regex(/^\/[A-Za-z0-9\-/]*(?:#[A-Za-z0-9-]+)?$/, {
  error: "An internal href is site-relative, e.g. /#visit (02 D-02.12).",
});

/* -------------------------------------------------------------------------- *
 * Scalars
 * -------------------------------------------------------------------------- */

/** A whole number of things: dimensions, counts, months, ratio sides. */
export const PositiveInt = z.number().int().positive();

/** Pixel dimensions of an image, required so Next can reserve the box (03). */
export const Image = z.strictObject({
  src: AssetPath,
  width: PositiveInt,
  height: PositiveInt,
});
export type Image = z.infer<typeof Image>;

/** A wall-clock time of day, `HH:MM` in `site.timeZone` (02 `D-02.6`). */
export const TimeOfDay = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, {
  error: "A time is 24-hour HH:MM in site.timeZone, e.g. 07:30 (02 D-02.6).",
});

/**
 * One emoji, optionally with a skin-tone modifier, a variation selector or a
 * ZWJ sequence: a pictogram used as *data* (`teachers[].icon`,
 * `principles[].icon`, `hero.mealsIcon`) rather than inline in copy, which 02
 * `D-02.5` keeps in the string instead.
 */
const EMOJI_PATTERN =
  /^\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\u{FE0F}|\u{200D}\p{Extended_Pictographic})*$/u;

export const Emoji = z
  .string()
  .trim()
  .min(1)
  .max(8)
  .refine((value) => EMOJI_PATTERN.test(value), {
    error: "This field holds a single emoji (02 D-02.5, 03 D-03.8).",
  });

/* -------------------------------------------------------------------------- *
 * Collection helpers
 * -------------------------------------------------------------------------- */

/**
 * Turn the ids `content/site.json` declares for one collection into a Zod key
 * schema (02 `D-02.11`, INV-02.3).
 *
 * The ids arrive at runtime — they are data, not types — so the resulting
 * record is keyed by `string`. What the enum buys is the *cross-reference*:
 * because Zod 4 records over an enum are exhaustive and reject unknown keys,
 * `z.record(idEnum(site.teachers.map(t => t.id)), TeacherText)` fails both ways
 * round — a teacher in `site.json` with no text, and text for a teacher
 * `site.json` never declared. That is the id half of INV-02.3, enforced by the
 * loader on every build rather than only by `pnpm validate:content`.
 *
 * An empty id list (today's reserved `faq`, D-02.17) yields a schema that
 * accepts `{}` and nothing else, which is exactly the reserved-namespace rule.
 */
export function idEnum(ids: readonly string[]): z.ZodEnum<Record<string, string>> {
  return z.enum([...ids]);
}

/** The parsed shape of one collection file: its ids mapped to their text. */
export type CollectionOf<TText> = Readonly<Record<string, TText>>;

/* -------------------------------------------------------------------------- *
 * Error reporting
 * -------------------------------------------------------------------------- */

/**
 * Parse `value`, or throw an `Error` whose message names the file and pretty-
 * prints every Zod issue (PR-3.3's acceptance check: an invalid `site.json`
 * fails `next build` with a *readable* issue, and shows it in the dev overlay).
 */
export function parseContent<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
  source: string,
): z.infer<TSchema> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const detail = z.prettifyError(result.error);
  throw new Error(`${source} does not match its content schema (02 D-02.7):\n${detail}`);
}
