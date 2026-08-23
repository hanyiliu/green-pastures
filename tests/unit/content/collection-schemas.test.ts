import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { faqCollectionSchema, FaqShared, FaqText } from "@/content/schemas/faq";
import {
  galleryCollectionSchema,
  GalleryPhotoShared,
  GalleryShared,
} from "@/content/schemas/gallery";
import { DayId, MealId, menuCollectionSchema, MenuShared } from "@/content/schemas/menu";
import { ProgramShared, programsCollectionSchema } from "@/content/schemas/programs";
import { TeacherShared, teachersCollectionSchema } from "@/content/schemas/teachers";
import { TestimonialShared, testimonialsCollectionSchema } from "@/content/schemas/testimonials";

/**
 * The six collection schemas (02 `D-02.11`, `D-02.13`, `D-02.17`; INV-02.3).
 *
 * Each one is an id record over what `content/site.json` declares, so the
 * claim under test everywhere below is the same: the join fails in **both**
 * directions — a declared id with no text, and text for an id nobody declared.
 */

function ok(schema: z.ZodType, value: unknown): boolean {
  return schema.safeParse(value).success;
}

function why(schema: z.ZodType, value: unknown): string {
  const result = schema.safeParse(value);
  return result.success ? "" : result.error.issues.map((issue) => issue.code).join(",");
}

/** The same object with one field deleted — a translator's omission. */
function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy: Partial<T> = { ...value };
  delete copy[key];
  return copy as Omit<T, K>;
}

/* -------------------------------------------------------------------------- *
 * programs
 * -------------------------------------------------------------------------- */

const programText = {
  name: "Infant",
  ageLabel: "6 – 18 months",
  summary: "Gentle days, one-to-three care.",
  description: "The longer paragraph the Programs page renders.",
  highlights: ["Sleep on demand", "Daily notes"],
  photoAlt: "A caregiver holding a baby",
};

describe("programs (02 D-02.11)", () => {
  const schema = programsCollectionSchema(["infant", "toddler"]);

  it("accepts exactly the declared ids", () => {
    expect(ok(schema, { infant: programText, toddler: programText })).toBe(true);
  });

  it("fails when a declared programme has no text", () => {
    expect(why(schema, { infant: programText })).toContain("invalid_type");
  });

  it("fails when the file answers a programme site.json never declared", () => {
    expect(
      why(schema, { infant: programText, toddler: programText, kindergarten: programText }),
    ).toBe("unrecognized_keys");
  });

  it("requires photoAlt, because every programme in site.json carries a photo", () => {
    expect(
      ok(programsCollectionSchema(["infant"]), { infant: without(programText, "photoAlt") }),
    ).toBe(false);
  });

  it("keeps summaryShort optional (D-02.13's mobile variant)", () => {
    const one = programsCollectionSchema(["infant"]);
    expect(ok(one, { infant: { ...programText, summaryShort: "Gentle days." } })).toBe(true);
    expect(ok(one, { infant: programText })).toBe(true);
  });

  it.each([
    ["none", []],
    ["four", ["a", "b", "c", "d"]],
  ])("rejects %s highlights — the design shows two or three chips", (_label, highlights) => {
    expect(
      ok(programsCollectionSchema(["infant"]), { infant: { ...programText, highlights } }),
    ).toBe(false);
  });

  it("is strict about the fields of one entry", () => {
    expect(
      why(programsCollectionSchema(["infant"]), { infant: { ...programText, tagline: "Grow" } }),
    ).toBe("unrecognized_keys");
  });

  it("rejects markup in a plain field", () => {
    expect(
      ok(programsCollectionSchema(["infant"]), {
        infant: { ...programText, summary: "Gentle <b>days</b>." },
      }),
    ).toBe(false);
  });

  it("shapes the shared half with defaults and an ordered age band", () => {
    const shared = ProgramShared.parse({
      id: "infant",
      ageMonths: [6, 18],
      ratio: [1, 3],
      photo: { src: "/images/programs/infant.jpg", width: 800, height: 800 },
    });
    expect(shared.featured).toBe(false);
  });
});

/* -------------------------------------------------------------------------- *
 * teachers
 * -------------------------------------------------------------------------- */

const teacherText = {
  name: "Ms. Ping",
  summary: "Your main point of contact.",
  bio: "The Team page paragraph.",
  tags: ["AMS certified"],
};

describe("teachers (02 Design → Collections → teachers)", () => {
  const schema = teachersCollectionSchema(["ping", "chen"]);

  it("fails in both directions", () => {
    expect(why(schema, { ping: teacherText })).toContain("invalid_type");
    expect(why(schema, { ping: teacherText, chen: teacherText, reyes: teacherText })).toBe(
      "unrecognized_keys",
    );
  });

  it("keeps photoAlt optional here — the cross-check lives in the loader", () => {
    expect(ok(teachersCollectionSchema(["ping"]), { ping: teacherText })).toBe(true);
    expect(
      ok(teachersCollectionSchema(["ping"]), {
        ping: { ...teacherText, photoAlt: "Our head teacher in the doorway" },
      }),
    ).toBe(true);
  });

  it("accepts an empty tag list and rejects a fourth chip", () => {
    const one = teachersCollectionSchema(["ping"]);
    expect(ok(one, { ping: { ...teacherText, tags: [] } })).toBe(true);
    expect(ok(one, { ping: { ...teacherText, tags: ["a", "b", "c", "d"] } })).toBe(false);
  });

  it("makes the badge and the photo slot data, never a name comparison", () => {
    const shared = TeacherShared.parse({ id: "reyes", icon: "🧸" });
    expect(shared.head).toBe(false);
    expect(shared.photo).toBeUndefined();
    expect(ok(TeacherShared, { id: "reyes", icon: "not an emoji" })).toBe(false);
  });
});

/* -------------------------------------------------------------------------- *
 * testimonials
 * -------------------------------------------------------------------------- */

const testimonialText = {
  quote: "The teachers truly <em>see</em> her.",
  author: "Mei L.",
  relation: "parent of a 3-year-old",
};

describe("testimonials (02 D-02.5)", () => {
  const schema = testimonialsCollectionSchema(["meiL"]);

  it("lets the quote carry an allowlisted rich tag", () => {
    expect(ok(schema, { meiL: testimonialText })).toBe(true);
  });

  it("rejects a tag outside the allowlist even in the quote", () => {
    expect(ok(schema, { meiL: { ...testimonialText, quote: "She <b>loves</b> it." } })).toBe(false);
  });

  it("keeps the author and relation plain text", () => {
    expect(ok(schema, { meiL: { ...testimonialText, author: "<em>Mei L.</em>" } })).toBe(false);
  });

  it("fails in both directions", () => {
    expect(why(schema, {})).toContain("invalid_type");
    expect(why(schema, { meiL: testimonialText, karenT: testimonialText })).toBe(
      "unrecognized_keys",
    );
  });

  it("caps the shared rating at five stars", () => {
    expect(ok(TestimonialShared, { id: "meiL", rating: 5 })).toBe(true);
    expect(ok(TestimonialShared, { id: "meiL", rating: 6 })).toBe(false);
    expect(TestimonialShared.parse({ id: "meiL", rating: 5 }).onHome).toBe(true);
  });
});

/* -------------------------------------------------------------------------- *
 * faq — reserved, not built (D-02.17)
 * -------------------------------------------------------------------------- */

describe("faq (02 D-02.17, HD-5)", () => {
  it("accepts {} and nothing else while site.json.faq[] is empty", () => {
    const reserved = faqCollectionSchema([]);
    expect(ok(reserved, {})).toBe(true);
    expect(why(reserved, { tuition: { question: "How much?", answer: "It depends." } })).toBe(
      "unrecognized_keys",
    );
  });

  it("takes rich text in the answer and plain text in the question", () => {
    expect(ok(FaqText, { question: "How much?", answer: "See <link>fees</link>." })).toBe(true);
    expect(ok(FaqText, { question: "How <em>much</em>?", answer: "It depends." })).toBe(false);
  });

  it("declares an optional topic on the shared half", () => {
    expect(FaqShared.parse({ id: "tuition" }).topic).toBeUndefined();
    expect(ok(FaqShared, { id: "tuition", topic: "money" })).toBe(true);
  });
});

/* -------------------------------------------------------------------------- *
 * gallery
 * -------------------------------------------------------------------------- */

const gallery = GalleryShared.parse({
  categories: [{ id: "classroom" }, { id: "outdoors", onMobile: false }],
  photos: [
    { id: "g01", src: "/images/gallery/g01.jpg", width: 1200, height: 900, category: "classroom" },
    { id: "g02", src: "/images/gallery/g02.jpg", width: 1200, height: 900, category: "outdoors" },
  ],
});

const galleryText = {
  categories: { classroom: "Classroom", outdoors: "Outdoors" },
  photos: {
    g01: { alt: "Children at the practical-life shelf" },
    g02: { alt: "A toddler on the garden path", caption: "Morning walk" },
  },
};

describe("gallery (02 D-02.11, INV-02.3)", () => {
  const schema = galleryCollectionSchema(gallery);

  it("accepts a name for every category and an alt for every photo", () => {
    expect(ok(schema, galleryText)).toBe(true);
  });

  it("fails when a photo added to site.json has no alt — an unlabelled image cannot ship", () => {
    const photos = without(galleryText.photos, "g02");
    expect(why(schema, { ...galleryText, photos })).toContain("invalid_type");
  });

  it("fails when the file names a photo site.json never declared", () => {
    expect(
      why(schema, {
        ...galleryText,
        photos: { ...galleryText.photos, g99: { alt: "A stray" } },
      }),
    ).toBe("unrecognized_keys");
  });

  it("fails when a category name is missing", () => {
    expect(why(schema, { ...galleryText, categories: { classroom: "Classroom" } })).toContain(
      "invalid_type",
    );
  });

  it("keeps the caption optional and the file strict", () => {
    expect(ok(schema, { ...galleryText, filters: {} })).toBe(false);
  });

  it("defaults the surface flags so site.json stays terse (D-02.13)", () => {
    const photo = GalleryPhotoShared.parse({
      id: "g01",
      src: "/images/gallery/g01.jpg",
      width: 1200,
      height: 900,
      category: "classroom",
    });
    expect([photo.wide, photo.onHome, photo.onMobile]).toStrictEqual([false, true, true]);
    expect(gallery.categories[1]?.onMobile).toBe(false);
  });
});

/* -------------------------------------------------------------------------- *
 * menu
 * -------------------------------------------------------------------------- */

const menu = MenuShared.parse({
  days: ["mon", "tue"],
  meals: ["breakfast", "lunch"],
  dietary: [{ id: "vegetarian" }, { id: "allergy", onHome: false }],
});

const menuText = {
  week: {
    mon: { breakfast: "Oatmeal & banana", lunch: "Chicken & veggie rice bowl" },
    tue: { breakfast: "Congee with egg", lunch: "Pasta marinara & peas" },
  },
  dietary: {
    vegetarian: { label: "🥦 Vegetarian options daily", labelShort: "🥦 Vegetarian daily" },
    allergy: { label: "Allergy-aware kitchen" },
  },
};

describe("menu (02 D-02.6, D-02.11)", () => {
  const schema = menuCollectionSchema(menu);

  it("cross-references site.json in three directions at once", () => {
    expect(ok(schema, menuText)).toBe(true);
  });

  it("fails when the week is missing a declared day", () => {
    expect(why(schema, { ...menuText, week: { mon: menuText.week.mon } })).toContain(
      "invalid_type",
    );
  });

  it("fails when the week carries a day site.json does not serve", () => {
    expect(
      why(schema, {
        ...menuText,
        week: { ...menuText.week, sat: { breakfast: "Toast", lunch: "Soup" } },
      }),
    ).toBe("unrecognized_keys");
  });

  it("fails when a day is missing a declared meal", () => {
    expect(
      why(schema, { ...menuText, week: { ...menuText.week, mon: { breakfast: "Oatmeal" } } }),
    ).toContain("invalid_type");
  });

  it("fails when a day carries a meal site.json does not serve", () => {
    expect(
      why(schema, {
        ...menuText,
        week: { ...menuText.week, mon: { ...menuText.week.mon, dinner: "Late supper" } },
      }),
    ).toBe("unrecognized_keys");
  });

  it("fails in both directions on the dietary chips", () => {
    expect(why(schema, { ...menuText, dietary: { vegetarian: { label: "🥦" } } })).toContain(
      "invalid_type",
    );
    expect(
      why(schema, { ...menuText, dietary: { ...menuText.dietary, halal: { label: "Halal" } } }),
    ).toBe("unrecognized_keys");
  });

  it("keeps day and meal ids a closed set — labels are derived, never stored", () => {
    expect(DayId.options).toStrictEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
    expect(MealId.options).toStrictEqual(["breakfast", "lunch", "snack"]);
    expect(ok(MenuShared, { ...menu, days: ["monday"] })).toBe(false);
    expect(menu.dietary[0]?.onHome).toBe(true);
  });
});
