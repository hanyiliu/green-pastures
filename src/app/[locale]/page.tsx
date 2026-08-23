/**
 * Home route — minimal on purpose (PR-3.1).
 *
 * It exists so `/en` and `/zh-Hans` are real, prerendered pages with the right
 * `<html lang>` while the i18n runtime is being proved. PR-5.1 onward replaces
 * this body with 04's eight home sections inside 05's `PageTransition`; the
 * `#main` landmark the layout's skip link targets stays.
 *
 * INV-02.1 bans literal user-visible text in JSX, so this placeholder renders
 * none: the copy arrives with the sections that own it.
 */
export default function HomePage() {
  return <main id="main" />;
}
