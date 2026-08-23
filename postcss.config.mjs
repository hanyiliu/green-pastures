/**
 * Tailwind CSS v4 runs as a PostCSS plugin (01 ADR-004).
 * v4 needs no `tailwind.config.*`: the theme is declared in CSS via `@theme`
 * (03 §1, §7) and filled by PR-4.1.
 *
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
