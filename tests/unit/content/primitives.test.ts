import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  AssetPath,
  Emoji,
  Id,
  idEnum,
  Image,
  InternalHref,
  LocalizedText,
  parseContent,
  PositiveInt,
  RichText,
  RoutePath,
  Text,
  TimeOfDay,
} from "@/content/schemas/primitives";
import { LOCALE_IDS, routing } from "@/i18n/routing";

/**
 * The content vocabulary (02 `D-02.5`, `D-02.7`, `D-02.8`, `D-02.11`,
 * `D-02.19`; INV-02.3, INV-02.8).
 *
 * These are the claims the schema module makes about itself, pinned one by one:
 * the tag allowlist is closed, a localized value is exhaustive over
 * `routing.locales`, an id record fails in both directions, and every object is
 * strict.
 */

function reasons(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

function codes(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.code);
}

/** The catalogue ids `routing.locales` does not enable yet (INV-02.11). */
function heldBack(): string[] {
  const enabled: readonly string[] = routing.locales;
  return LOCALE_IDS.filter((id) => !enabled.includes(id));
}

/**
 * An id `LocalizedText` must refuse. A catalogue id that is held back is the
 * sharpest case — `zh-Hant` was one until PR-3.9, and would be again if D-10.12
 * withdrew it — but the catalogue is fully enabled today, so the rule is stated
 * against an id the project does not know at all. Same refusal, same code.
 */
function refusedId(): string {
  return heldBack()[0] ?? "ja";
}

describe("Text (02 D-02.5, D-02.8, INV-02.8)", () => {
  it("trims, so a stray space in a JSON edit cannot reach the page", () => {
    expect(Text.parse("  Follow the child  ")).toBe("Follow the child");
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
  ])("rejects a %s value — a missing string must be a missing key", (_label, value) => {
    expect(Text.safeParse(value).success).toBe(false);
  });

  it.each([
    ["a rich tag", "The teachers truly <em>see</em> her"],
    ["a formatting tag", "<b>bold</b>"],
    ["a script tag", "<script>alert(1)</script>"],
    ["a self-closing tag", "line<br/>break"],
  ])("rejects %s — plain text carries no markup at all", (_label, value) => {
    const result = Text.safeParse(value);
    expect(result.success).toBe(false);
    expect(reasons(result).join(" ")).toContain("HTML is not allowed in a content value");
  });

  it.each([
    ["a bare less-than", "Ages 3 < 5"],
    ["an unclosed angle bracket", "a<b"],
    ["CJK copy", "跟随孩子"],
  ])("accepts %s", (_label, value) => {
    expect(Text.safeParse(value).success).toBe(true);
  });
});

describe("RichText (02 D-02.5)", () => {
  it.each(["em", "strong", "link", "count", "day"])(
    "allows the <%s> tag from the closed allowlist",
    (tag) => {
      expect(RichText.safeParse(`before <${tag}>inside</${tag}> after`).success).toBe(true);
    },
  );

  it("accepts a value with no tags at all", () => {
    expect(RichText.parse("  A quiet morning  ")).toBe("A quiet morning");
  });

  it.each([
    ["<b>", "<b>bold</b>"],
    ["<script>", "<script>alert(1)</script>"],
    ["<i>", "an <i>aside</i>"],
    ["an allowlisted tag carrying an attribute", '<link href="/visit">book</link>'],
  ])("rejects %s", (_label, value) => {
    const result = RichText.safeParse(value);
    expect(result.success).toBe(false);
    expect(reasons(result).join(" ")).toContain("Only the rich tags");
  });

  it("rejects an empty value like Text does", () => {
    expect(RichText.safeParse("   ").success).toBe(false);
  });
});

describe("LocalizedText (02 D-02.19, INV-02.3)", () => {
  const complete = (): Record<string, string> =>
    Object.fromEntries(routing.locales.map((id) => [id, `brand-${id}`]));

  it("accepts exactly one entry per enabled locale", () => {
    expect(LocalizedText.safeParse(complete()).success).toBe(true);
  });

  it.each([...routing.locales])("requires an entry for the enabled locale %s", (id) => {
    const value = complete();
    delete value[id];
    const result = LocalizedText.safeParse(value);
    expect(result.success).toBe(false);
    expect(codes(result)).toContain("invalid_type");
  });

  it("rejects an id that routing.locales does not enable", () => {
    const refused = refusedId();
    expect(routing.locales).not.toContain(refused);
    const result = LocalizedText.safeParse({ ...complete(), [refused]: "優朵幼兒園" });
    expect(result.success).toBe(false);
    expect(codes(result)).toContain("unrecognized_keys");
  });

  it("takes its key set from routing.locales — enabling a locale forces its brand name", () => {
    // The deliberate coupling of D-02.19: the key schema *is* `routing.locales`,
    // so adding `zh-Hant` there broke every localized value until PR-3.9
    // authored its brand names — and withdrawing it under D-10.12 would break
    // them again from the other side, because the value may then carry no
    // `zh-Hant` entry. The assertion tracks whichever state the catalogue and
    // the enabled set are in, so it states the coupling rather than the day.
    expect(Object.keys(complete())).toStrictEqual([...routing.locales]);
    const everyKnownId = Object.fromEntries(LOCALE_IDS.map((id) => [id, `brand-${id}`]));
    expect(LocalizedText.safeParse(everyKnownId).success).toBe(heldBack().length === 0);
  });

  it("applies Text to every entry, so a locale cannot hold an empty string", () => {
    expect(LocalizedText.safeParse({ ...complete(), en: "" }).success).toBe(false);
  });
});

describe("identifiers and paths (02 D-02.11, D-02.12)", () => {
  it.each([
    ["meiL", true],
    ["followTheChild", true],
    ["g01", true],
    ["MeiL", false],
    ["mei-l", false],
    ["1a", false],
    ["", false],
  ])("Id(%s) is %s", (value, ok) => {
    expect(Id.safeParse(value).success).toBe(ok);
  });

  it.each([
    ["/images/hero.jpg", true],
    ["/og/cover.png", true],
    ["/images/team/ping.jpeg", true],
    ["images/hero.jpg", false],
    ["/images/hero", false],
    ["/images/hero.j", false],
    ["https://cdn.example/hero.jpg", false],
  ])("AssetPath(%s) is %s", (value, ok) => {
    expect(AssetPath.safeParse(value).success).toBe(ok);
  });

  it.each([
    ["/philosophy", true],
    ["/two-words", true],
    ["/Philosophy", false],
    ["/nested/path", false],
    ["philosophy", false],
  ])("RoutePath(%s) is %s", (value, ok) => {
    expect(RoutePath.safeParse(value).success).toBe(ok);
  });

  it.each([
    ["/#visit", true],
    ["/programs", true],
    ["/", true],
    ["https://example.test/visit", false],
    ["/visit?utm=1", false],
  ])("InternalHref(%s) is %s", (value, ok) => {
    expect(InternalHref.safeParse(value).success).toBe(ok);
  });

  it.each([
    ["07:30", true],
    ["23:59", true],
    ["00:00", true],
    ["24:00", false],
    ["7:30", false],
    ["07:60", false],
  ])("TimeOfDay(%s) is %s", (value, ok) => {
    expect(TimeOfDay.safeParse(value).success).toBe(ok);
  });
});

describe("scalars", () => {
  it.each([
    [1, true],
    [1600, true],
    [0, false],
    [-1, false],
    [1.5, false],
  ])("PositiveInt(%s) is %s", (value, ok) => {
    expect(PositiveInt.safeParse(value).success).toBe(ok);
  });

  it("Image requires the pixel box Next needs to reserve", () => {
    expect(Image.safeParse({ src: "/images/hero.jpg", width: 1600, height: 1200 }).success).toBe(
      true,
    );
    expect(Image.safeParse({ src: "/images/hero.jpg", width: 1600 }).success).toBe(false);
  });

  it("Image is strict: an unknown key is rejected, not ignored", () => {
    const result = Image.safeParse({
      src: "/images/hero.jpg",
      width: 1600,
      height: 1200,
      alt: "a child painting",
    });
    expect(result.success).toBe(false);
    expect(codes(result)).toStrictEqual(["unrecognized_keys"]);
  });

  it.each([
    ["🍎", true],
    ["🧸", true],
    ["👩🏽", true],
    ["☺️", true],
    ["👨‍👩‍👧", true],
    ["🍎🥦", false],
    ["a", false],
    ["", false],
  ])("Emoji(%s) is %s", (value, ok) => {
    expect(Emoji.safeParse(value).success).toBe(ok);
  });
});

describe("idEnum (02 D-02.11, INV-02.3)", () => {
  const record = z.record(idEnum(["infant", "toddler"]), Text);

  it("accepts exactly the declared ids", () => {
    expect(record.safeParse({ infant: "Infant", toddler: "Toddler" }).success).toBe(true);
  });

  it("fails when site.json declares an id the text file never answers", () => {
    const result = record.safeParse({ infant: "Infant" });
    expect(result.success).toBe(false);
    expect(codes(result)).toContain("invalid_type");
  });

  it("fails when the text file answers an id site.json never declared", () => {
    const result = record.safeParse({ infant: "Infant", toddler: "Toddler", preschool: "Pre" });
    expect(result.success).toBe(false);
    expect(codes(result)).toStrictEqual(["unrecognized_keys"]);
  });

  it("over an empty id list accepts {} and rejects every key (D-02.17's reserved namespace)", () => {
    const reserved = z.record(idEnum([]), Text);
    expect(reserved.safeParse({}).success).toBe(true);
    expect(reserved.safeParse({ anything: "text" }).success).toBe(false);
  });
});

describe("parseContent", () => {
  it("returns the parsed value on success", () => {
    expect(parseContent(Text, "  hello  ", "content/en/messages/common.json")).toBe("hello");
  });

  it("throws an error naming the file and pretty-printing every issue", () => {
    const schema = z.strictObject({ name: Text, ageLabel: Text });
    let thrown: unknown;
    try {
      parseContent(schema, { name: "" }, "content/en/collections/programs.json");
    } catch (error: unknown) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = thrown instanceof Error ? thrown.message : "";
    expect(message).toContain("content/en/collections/programs.json");
    expect(message).toContain("does not match its content schema (02 D-02.7)");
    expect(message).toContain("ageLabel");
    expect(message).toContain("name");
  });
});
