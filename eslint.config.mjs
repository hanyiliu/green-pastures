/**
 * ESLint flat config (PR-2.5, 08 §2 / D-08.3).
 *
 * Next 16 removed `next lint`, so ESLint runs directly: `pnpm lint` is
 * `eslint . --max-warnings 0`. Everything here is `error`; nothing is a warning,
 * because `--max-warnings 0` makes the distinction meaningless and a rule that
 * only warns is a rule nobody fixes.
 *
 * Every project ban below names the invariant it enforces. The bans are the
 * default for the whole tree; the exemptions at the bottom are the only places
 * the plan allows the banned construct, and each names its source.
 *
 * OQ-08.5, verified here (see the note above `jsxNoLiteralAttributes`):
 * `react/jsx-no-literals` in eslint-plugin-react 7.37.5 has **no**
 * `restrictedAttributes` option, so D-08.2's attribute half is implemented by
 * the local rule this file defines — the fallback OQ-08.5 pre-authorised.
 */
import js from "@eslint/js";
import next from "@next/eslint-plugin-next";
import vitest from "@vitest/eslint-plugin";
import prettier from "eslint-config-prettier/flat";
import jsxA11y from "eslint-plugin-jsx-a11y";
import playwright from "eslint-plugin-playwright";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/* ------------------------------------------------------------------------- *
 * INV-02.1 — no literal user-visible text in JSX/TSX (02, D-08.2)
 * ------------------------------------------------------------------------- */

/**
 * The closed allowlist of D-08.2: the design's separators and symbols, the ten
 * single digits, and the design's emoji. `allowedStrings` is an exact-string
 * Set compared after `trim()` — it is NOT a regex, NOT a prefix and NOT a
 * character class, so `'·'` allows the string `·` and nothing that contains it.
 * Anything not on this list is a lint error.
 */
const ALLOWED_STRINGS = [
  // separators and symbols (03 §5)
  "·",
  "—",
  "–",
  "→",
  "↗",
  "←",
  "⌄",
  "★",
  "½",
  "*",
  "/",
  ":",
  "|",
  "%",
  "(",
  ")",
  ",",
  ".",
  "&",
  // the ten single digits
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  // the design's emoji
  "🌿",
  "🌱",
  "🍎",
  "🥦",
  "🌾",
  "🧸",
  "🎨",
  "🏡",
  "🌟",
  "✋",
  "🍚",
  "📚",
];

/**
 * The attribute half of D-08.2. 08 §2 writes this as a `restrictedAttributes`
 * option of `react/jsx-no-literals`; that option does not exist in
 * eslint-plugin-react 7.37.5 (its schema is `additionalProperties: false` over
 * `noStrings` / `allowedStrings` / `ignoreProps` / `noAttributeStrings` /
 * `elementOverrides`, so passing it is a config error), and `noAttributeStrings`
 * is inert whenever `ignoreProps: true` — which D-08.2 requires, since without
 * it every `className` / `href` / `type` string is reported. OQ-08.5 named this
 * exact risk and pre-authorised "a 20-line local rule in `eslint.config.mjs`".
 * This is that rule; the gate is unchanged.
 */
const RESTRICTED_ATTRIBUTES = [
  "alt",
  "aria-label",
  "aria-description",
  "aria-roledescription",
  "aria-valuetext",
  "title",
  "placeholder",
  "label",
];

/** @type {import('eslint').ESLint.Plugin} */
const gp = {
  meta: { name: "eslint-plugin-gp", version: "1.0.0" },
  rules: {
    "jsx-no-literal-attributes": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Disallow literal user-visible strings in accessible-name attributes (INV-02.1, D-08.2)",
        },
        schema: [
          {
            type: "object",
            properties: {
              restrictedAttributes: { type: "array", items: { type: "string" } },
              allowedStrings: { type: "array", items: { type: "string" }, uniqueItems: true },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          literalAttribute:
            'Strings not allowed in attribute "{{attribute}}": "{{text}}" — read it from a message key (INV-02.1).',
        },
      },
      create(context) {
        const options = context.options[0] ?? {};
        const restricted = new Set(options.restrictedAttributes ?? RESTRICTED_ATTRIBUTES);
        const allowed = new Set((options.allowedStrings ?? ALLOWED_STRINGS).map((s) => s.trim()));

        /** @param {any} node @param {string} text */
        const report = (node, text) => {
          const trimmed = text.trim();
          if (trimmed === "" || allowed.has(trimmed)) return;
          context.report({
            node,
            messageId: "literalAttribute",
            data: { attribute: String(node.name.name), text: trimmed },
          });
        };

        return {
          /** @param {any} node */
          JSXAttribute(node) {
            if (node.name?.type !== "JSXIdentifier" || !restricted.has(node.name.name)) return;
            const value = node.value;
            if (!value) return;

            // alt="A child painting"
            if (value.type === "Literal" && typeof value.value === "string") {
              report(node, value.value);
              return;
            }

            if (value.type !== "JSXExpressionContainer") return;
            const expression = value.expression;

            // alt={'A child painting'}
            if (expression.type === "Literal" && typeof expression.value === "string") {
              report(node, expression.value);
              return;
            }

            // alt={`A child painting`} — a template with no substitutions is a literal
            if (expression.type === "TemplateLiteral" && expression.expressions.length === 0) {
              report(node, expression.quasis.map((q) => q.value.cooked ?? "").join(""));
            }
          },
        };
      },
    },
  },
};

/* ------------------------------------------------------------------------- *
 * Project bans (08 §2). Each entry is named so the exemption blocks below can
 * re-compose the list without restating a selector.
 * ------------------------------------------------------------------------- */

const IMPORT_BAN = {
  /** INV-02.7 — locale lives in the URL; navigation comes from src/i18n. */
  nextLink: {
    name: "next/link",
    message: "use Link from src/i18n/navigation (INV-02.7)",
  },
  /** INV-02.7 */
  nextNavigation: {
    name: "next/navigation",
    message: "use src/i18n/navigation (INV-02.7)",
  },
  /** INV-05.11 — one animation library. */
  gsap: { name: "gsap", message: "motion/react only (INV-05.11)" },
  /** INV-05.11 */
  framerMotion: { name: "framer-motion", message: "motion/react only (INV-05.11)" },
  /** D-05.5 — LazyMotion strict: components use `m` from motion/react-m. */
  motionReact: {
    name: "motion/react",
    importNames: ["motion", "AnimatePresence"],
    message: "use `m` from motion/react-m under LazyMotion strict (D-05.5, INV-05.11)",
  },
};

const SYNTAX_BAN = {
  /**
   * INV-02.9 — no locale branching. `/^(en|zh)/` covers every enabled id
   * (`en`, `zh-Hans`, `zh-Hant`) and still catches the retired `'zh'`.
   */
  localeBranch: {
    selector:
      "BinaryExpression[operator=/^[!=]==?$/][left.name='locale'][right.value=/^(en|zh)/], " +
      "BinaryExpression[operator=/^[!=]==?$/][right.name='locale'][left.value=/^(en|zh)/], " +
      "SwitchStatement[discriminant.name='locale']",
    message: "no locale branching (INV-02.9)",
  },
  /**
   * INV-03.3 — only `md:` / `lg:` (and `xl:` for container caps). The
   * `TemplateElement` twin is this file's addition: 08 §2 calls its selectors
   * illustrative, and a banned variant inside `className={`…`}` is the same bug.
   */
  breakpointVariant: {
    selector:
      "JSXAttribute[name.name='className'] Literal[value=/(^|\\s)(sm|2xl|3xl|xs|max-\\w+):/], " +
      "JSXAttribute[name.name='className'] TemplateElement[value.raw=/(^|\\s)(sm|2xl|3xl|xs|max-\\w+):/]",
    message: "only md:/lg:/xl: (INV-03.3)",
  },
  /** INV-03.1 / INV-03.2 — no arbitrary colour, px, ms or bezier in a class. */
  arbitraryValue: {
    selector:
      "JSXAttribute[name.name='className'] Literal[value=/-\\[#|\\[[0-9.]+(px|ms|rem|s)\\]|cubic-bezier/], " +
      "JSXAttribute[name.name='className'] TemplateElement[value.raw=/-\\[#|\\[[0-9.]+(px|ms|rem|s)\\]/]",
    message: "arbitrary value — use a token (INV-03.1/2)",
  },
  /** INV-03.1, the inline-style half (03 §11; 08 §2 note (a)). */
  inlineStyleColour: {
    selector:
      "JSXAttribute[name.name='style'] Literal[value=/#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\(|oklch\\(|color-mix\\(/], " +
      "JSXAttribute[name.name='style'] TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\(|oklch\\(|color-mix\\(/]",
    message: "raw colour in style={} — use var(--color-*) (INV-03.1)",
  },
  /** INV-03.6 (08 §2 note (c)) — the script stack is chosen by :lang(), never by hand. */
  scriptStackUtility: {
    selector:
      "JSXAttribute[name.name='className'] Literal[value=/\\bfont-cjk-(sc|tc)\\b/], " +
      "JSXAttribute[name.name='className'] TemplateElement[value.raw=/\\bfont-cjk-(sc|tc)\\b/]",
    message: "use font-display/font-body; :lang() picks the script (INV-03.6)",
  },
  /**
   * INV-05.6 — motion values come from the token catalogue.
   *
   * The shape is the whole point: what is banned is a *literal* in the
   * positions Motion reads a time or a curve, never the positions themselves.
   * `duration: dur.rise` and `ease: ease.spring` are member expressions and
   * pass; `duration: 0.75` and `ease: [0.34, 1.56, 0.5, 1]` are literals and
   * fail. That distinction is what makes this ban safe to apply to
   * `src/components/motion/variants.ts` itself — see `gp/exempt-motion-components`.
   *
   * Two widenings of 08 §2's excerpt, both of which close a hole rather than
   * open one:
   *
   * - `Literal` is matched as a **descendant**, not a direct child, so
   *   `delay: index * 0.014`, `duration: 0.75 as number` and
   *   `delayChildren: stagger(0.11)` are caught alongside the bare form. The
   *   only nodes this adds are literals *inside* a motion value's expression,
   *   which INV-05.6 bans just as squarely as the value itself.
   * - `ease` joins the key list instead of being spelled `> ArrayExpression`.
   *   The old form was simultaneously too loose — `ease: 'easeOut'` is a raw
   *   easing and slipped through — and too tight: `ease: [ease.soft,
   *   ease.std]`, Motion's legal per-segment easing array, is entirely
   *   token-sourced and was banned anyway, which is the sort of false positive
   *   that gets a file exempted.
   *
   * What this cannot cover is INV-05.6's *distance* clause. `y: rise.base` and
   * `y: -34` are the same syntax in the same position, and only the first is a
   * token; the second is §5.2 keyframe geometry, which `variants.ts` owns and
   * for which 03 mints nothing. No selector separates them. Distances are held
   * by the catalogue unit test (08 §4), not by lint.
   */
  motionValue: {
    selector:
      "Property[key.name=/^(duration|delay|ease|staggerChildren|delayChildren|repeatDelay)$/] Literal",
    message: "motion values from tokens (INV-05.6)",
  },
  /** INV-05.3 — will-change is applied for the duration of an animation, never statically. */
  staticWillChange: {
    selector:
      "Property[key.name='willChange'], JSXAttribute[name.name='style'] Literal[value=/will-change/]",
    message: "no static will-change (INV-05.3)",
  },
  /** INV-05.9 — one pooled observer; no ad-hoc scroll listeners. */
  scrollListener: {
    selector: "CallExpression[callee.property.name='addEventListener'][arguments.0.value='scroll']",
    message: "no scroll listeners outside src/components/motion (INV-05.9)",
  },
  /** INV-07.3 — the three server secrets are read in two places only. */
  serverEnv: {
    selector:
      "MemberExpression[object.object.name='process'][object.property.name='env']" +
      "[property.name=/^(RESEND_API_KEY|TURNSTILE_SECRET_KEY|INQUIRY_TO_EMAIL)$/], " +
      "MemberExpression[computed=true][object.object.name='process'][object.property.name='env']" +
      "[property.value=/^(RESEND_API_KEY|TURNSTILE_SECRET_KEY|INQUIRY_TO_EMAIL)$/]",
    message: "read this only in src/app/api/** or src/lib/inquiry/server/** (INV-07.3)",
  },
};

/** D-08.13 — a flake is fixed by synchronisation, never by a longer clock. */
const TEST_TIMEOUT_BAN = {
  selector: "CallExpression[callee.object.name='test'][callee.property.name=/^(setTimeout|slow)$/]",
  message: "fix the synchronisation, do not extend the clock (D-08.13)",
};

/** @param {Array<{ selector: string, message: string }>} entries */
const noRestrictedSyntax = (entries) => /** @type {const} */ (["error", ...entries]);

/** @param {Array<Record<string, unknown>>} paths */
const noRestrictedImports = (paths) => /** @type {const} */ (["error", { paths }]);

const ALL_SYNTAX_BANS = Object.values(SYNTAX_BAN);
const ALL_IMPORT_BANS = Object.values(IMPORT_BAN);

/** @param {...string} keys @returns {Array<{ selector: string, message: string }>} */
const syntaxBansExcept = (...keys) =>
  Object.entries(SYNTAX_BAN)
    .filter(([key]) => !keys.includes(key))
    .map(([, value]) => value);

/** @param {...string} keys @returns {Array<Record<string, unknown>>} */
const importBansExcept = (...keys) =>
  Object.entries(IMPORT_BAN)
    .filter(([key]) => !keys.includes(key))
    .map(([, value]) => value);

export default tseslint.config(
  {
    name: "gp/ignores",
    ignores: [
      ".next/**",
      "coverage/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "reports/**",
      "next-env.d.ts",
      // Generated beside every content/en JSON by next-intl's
      // `createMessagesDeclaration` (02 D-02.7, next.config.ts).
      "**/*.d.json.ts",
      "docs/**",
      ".beads/**",
      ".claude/**",
    ],
  },

  /* --------------------------------------------------------------------- *
   * Base layers
   * --------------------------------------------------------------------- */
  { name: "gp/js-recommended", ...js.configs.recommended },
  ...tseslint.configs.recommendedTypeChecked,
  {
    name: "gp/language-options",
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    // Config files and any plain JS are linted, but not type-aware: they are
    // outside `tsconfig.json`'s `include`.
    name: "gp/untyped-files",
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  /* --------------------------------------------------------------------- *
   * React / Next / a11y — JSX files only
   * --------------------------------------------------------------------- */
  {
    name: "gp/react",
    files: ["**/*.{jsx,tsx}"],
    extends: [
      react.configs.flat.recommended,
      react.configs.flat["jsx-runtime"],
      reactHooks.configs.flat["recommended-latest"],
      jsxA11y.flatConfigs.strict,
      next.configs["core-web-vitals"],
    ],
    settings: { react: { version: "detect" } },
    rules: {
      // 08 §2 lists these two by name beside the jsx-a11y preset.
      "@next/next/no-img-element": "error",
      "@next/next/no-html-link-for-pages": "error",
    },
  },

  /* --------------------------------------------------------------------- *
   * INV-02.1 — literal user-visible text
   * --------------------------------------------------------------------- */
  {
    name: "gp/inv-02.1-no-literal-text",
    files: ["**/*.{jsx,tsx}"],
    plugins: { gp },
    rules: {
      // D-08.2. `ignoreProps: true` is required: with `false` the rule reports
      // every plain attribute string (`className`, `href`, `type` …).
      // `allowedStrings` is an exact-match Set over the trimmed text.
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: ALLOWED_STRINGS,
          // `elementOverrides` stays empty: no element is allowed to carry copy.
          // 04's components add entries here only with an 02 decision behind them.
          elementOverrides: {},
        },
      ],
      // D-08.2's attribute half — see the note on `gp` above (OQ-08.5).
      "gp/jsx-no-literal-attributes": [
        "error",
        { restrictedAttributes: RESTRICTED_ATTRIBUTES, allowedStrings: ALLOWED_STRINGS },
      ],
    },
  },

  /* --------------------------------------------------------------------- *
   * Project bans — the default for the whole tree
   * --------------------------------------------------------------------- */
  {
    name: "gp/project-bans",
    rules: {
      "no-restricted-imports": noRestrictedImports(ALL_IMPORT_BANS),
      "no-restricted-syntax": noRestrictedSyntax(ALL_SYNTAX_BANS),
    },
  },

  /* --------------------------------------------------------------------- *
   * Exemptions. Each path is the tree 04 §2 / 02 actually use; a glob that
   * matches nothing silently disables the override it was written for
   * (memo ADJ-15), so these are spelled exactly.
   * --------------------------------------------------------------------- */
  {
    // 02 INV-02.7 / INV-02.9: src/i18n is where navigation and locale ids live.
    name: "gp/exempt-i18n",
    files: ["src/i18n/**"],
    rules: {
      "no-restricted-imports": noRestrictedImports(importBansExcept("nextLink", "nextNavigation")),
      "no-restricted-syntax": noRestrictedSyntax(syntaxBansExcept("localeBranch")),
    },
  },
  {
    // 05 §5.12: the motion tree owns the pooled observer and the scroll listener.
    //
    // `scrollListener` is the *only* ban this tree is excused. 08 §2 also
    // excuses `src/components/motion/variants.ts` from `motionValue`, on the
    // stated grounds that `src/components/motion/**` "is where `ease`/`duration`
    // literals are *defined*". That premise does not hold: `variants.ts` defines
    // no duration and no easing — it imports every one of them from
    // `src/design/tokens.ts`, which is the actual definition site and keeps its
    // own exemption below. What `variants.ts` owns is the *geometry* of the
    // entrances — keyframe stops, `times`, transform origins — and `motionValue`
    // never matched any of those, so the exemption bought the catalogue nothing
    // it needed while removing the only automated check INV-05.6 has in the one
    // file it is aimed at. It is withdrawn here; 08 §2's "Overrides" paragraph
    // is now one file out of date on this point.
    name: "gp/exempt-motion-components",
    files: ["src/components/motion/**"],
    rules: {
      "no-restricted-syntax": noRestrictedSyntax(syntaxBansExcept("scrollListener")),
    },
  },
  {
    // D-05.5: the two files that legitimately import from motion/react.
    name: "gp/exempt-motion-provider",
    files: ["src/components/motion/MotionProvider.tsx", "src/components/motion/WordSwap.tsx"],
    rules: {
      "no-restricted-imports": noRestrictedImports(importBansExcept("motionReact")),
    },
  },
  {
    // INV-03.4 / INV-05.6: the one file where motion values are *defined*.
    // 03's TS mirror is the bottom of the chain — the numbers have to be typed
    // somewhere, and this is the somewhere. Everything downstream imports them,
    // which is why nothing downstream is exempt.
    name: "gp/exempt-token-catalogue-design",
    files: ["src/design/tokens.ts"],
    rules: {
      "no-restricted-syntax": noRestrictedSyntax(syntaxBansExcept("motionValue")),
    },
  },
  {
    // INV-07.3: the only two places allowed to read the server secrets.
    name: "gp/exempt-server-env",
    files: ["src/app/api/**", "src/lib/inquiry/server/**"],
    rules: {
      "no-restricted-syntax": noRestrictedSyntax(syntaxBansExcept("serverEnv")),
    },
  },

  /* --------------------------------------------------------------------- *
   * Tests
   * --------------------------------------------------------------------- */
  {
    name: "gp/e2e",
    files: ["e2e/**/*.{ts,tsx}", "playwright.config.ts"],
    extends: [playwright.configs["flat/recommended"]],
    rules: {
      "playwright/no-wait-for-timeout": "error",
      "playwright/no-networkidle": "error",
      "playwright/no-force-option": "error",
      "playwright/expect-expect": "error",
      "no-restricted-syntax": noRestrictedSyntax([...ALL_SYNTAX_BANS, TEST_TIMEOUT_BAN]),
    },
  },
  {
    name: "gp/unit",
    files: ["tests/**/*.{ts,tsx}"],
    extends: [vitest.configs.recommended],
    languageOptions: { globals: vitest.environments.env.globals },
    rules: {
      // Test files render fixture markup; INV-02.1 is a rule about the product.
      "react/jsx-no-literals": "off",
      "gp/jsx-no-literal-attributes": "off",
      // `motionValue` is a rule about the product too, and in a unit test it
      // inverts: 08 §4 asks the catalogue test to assert "durations/easings
      // reference tokens", and the only assertion that can fail is one that
      // spells the expected number out — `expect(…duration).toBe(0.75)`.
      // Import `dur.rise` to satisfy the ban instead and the assertion becomes
      // `dur.rise === dur.rise`, a test that cannot fail. The literal in an
      // `expect` is the check, not a hard-coded animation, so the ban comes off
      // here and the catalogue test keeps its teeth. Every other ban stays on;
      // `gp/e2e` keeps the full set, having no motion values to assert.
      "no-restricted-syntax": noRestrictedSyntax(syntaxBansExcept("motionValue")),
    },
  },

  /* --------------------------------------------------------------------- *
   * Prettier last — it only turns formatting rules off.
   * --------------------------------------------------------------------- */
  prettier,
);
