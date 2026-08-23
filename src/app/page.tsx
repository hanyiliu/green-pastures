/**
 * Root page — deliberately blank (PR-2.4).
 *
 * INV-02.1 bans literal user-visible text in JSX/TSX and PR-2.5's
 * `react/jsx-no-literals` rule enforces it before the first component exists,
 * so the scaffold renders nothing rather than a placeholder string.
 *
 * PR-3.1 replaces this route: `src/proxy.ts` negotiates a locale on `/` and
 * redirects to `/{locale}` (01 ADR-008, `localePrefix: 'always'`), and the real
 * homepage lives at `src/app/[locale]/page.tsx`.
 */
export default function RootPage() {
  return <main />;
}
