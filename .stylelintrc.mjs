/**
 * Stylelint (PR-2.5, 08 §2 / D-08.4) over `src/**\/*.css`.
 *
 * ESLint cannot see a colour or a duration that is written in CSS, so the same
 * invariants are enforced twice: the `className` / `style={}` half in
 * `eslint.config.mjs`, the stylesheet half here.
 *
 * `src/styles/tokens.css` (PR-4.1) is the ONE file exempt from the colour, px
 * and ms bans, because it is the file that *declares* the tokens (D-08.4).
 */

/** INV-03.2 — the properties whose values must come from tokens. */
const TOKENISED_PROPERTIES =
  "/^(transition|animation|box-shadow|border-radius|padding|margin|gap|width|height|font-size|top|left|right|bottom|inset)/";

/**
 * INV-03.2 — a raw `px` (other than `0`, `1px`, `1.5px` hairlines), any raw
 * `ms`/`s` duration, any inline bezier.
 */
const RAW_VALUE_PATTERNS = [
  "/(?<![\\d.])(?!(0|1|1\\.5)px\\b)\\d+(\\.\\d+)?px/",
  "/\\d+m?s\\b/",
  "/cubic-bezier/",
];

/** @type {Record<string, string[]>} */
const TOKEN_VALUE_BANS = { [TOKENISED_PROPERTIES]: RAW_VALUE_PATTERNS };

/**
 * INV-05.2 — a clipping ancestor kills a stagger reveal. `html { overflow-x:
 * clip }` in `globals.css` is the one allowed site, which is why this block is
 * scoped to `src/components/**` rather than declared globally.
 * Stylelint replaces (rather than merges) a rule's options in an override, so
 * the token bans are restated here.
 */
const COMPONENT_VALUE_BANS = {
  ...TOKEN_VALUE_BANS,
  overflow: ["/hidden|clip|auto/"],
  contain: ["paint"],
  "content-visibility": ["auto"],
};

/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard", "stylelint-config-tailwindcss"],
  rules: {
    /* INV-03.1 — no raw colour anywhere but the token file. */
    "color-no-hex": true,
    "color-named": "never",
    "function-disallowed-list": ["rgb", "rgba", "hsl", "hsla", "oklch", "color-mix"],

    /* INV-03.2 — no raw px / ms / bezier on the tokenised properties. */
    "declaration-property-value-disallowed-list": TOKEN_VALUE_BANS,

    /* INV-05.3 — will-change is applied for the duration of an animation only. */
    "property-disallowed-list": ["will-change"],

    /* INV-05.11 — keyframes live in the two motion stylesheets (04 §2). */
    "at-rule-disallowed-list": ["keyframes"],
  },
  overrides: [
    {
      /* D-08.4 — the file that declares the tokens cannot be bound by them. */
      files: ["src/styles/tokens.css"],
      rules: {
        "color-no-hex": null,
        "color-named": null,
        "function-disallowed-list": null,
        "declaration-property-value-disallowed-list": null,
      },
    },
    {
      /* INV-05.2 — clipping and containment bans, components only. */
      files: ["src/components/**/*.css"],
      rules: { "declaration-property-value-disallowed-list": COMPONENT_VALUE_BANS },
    },
    {
      /*
       * INV-05.1 / INV-05.11 — the only two files allowed to declare keyframes,
       * and inside them only compositor-friendly properties (`filter` is for the
       * `ink` decoration only, reviewed).
       */
      files: ["src/components/motion/ambient.css", "src/components/motion/view-transitions.css"],
      rules: {
        "at-rule-disallowed-list": null,
        "property-allowed-list": [
          "transform",
          "translate",
          "rotate",
          "scale",
          "opacity",
          "/^animation/",
          "/^offset/",
          "filter",
        ],
      },
    },
  ],
};
