import type { formats } from "./formats";
import type { Messages } from "./messages";
import type { routing } from "./routing";

/**
 * Compile-time typing for next-intl (02 `D-02.7`).
 *
 * `Messages` derives from the `en` tree, so `t("home.hero.titel")` is a type
 * error rather than a runtime `⟦…⟧` marker; `Locale` is the enabled locale
 * union, so `useLocale()` and every `locale` prop are narrowed to real ids;
 * `Formats` is `typeof formats`, so `{rating, number, rating}` only compiles
 * while that named format exists.
 *
 * Strictly typed ICU *arguments* come from the `.d.json.ts` companions the
 * next-intl plugin generates for every `content/en/**` file
 * (`experimental.createMessagesDeclaration` in `next.config.ts`); they are
 * generated, git-ignored artifacts.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: Messages;
    Formats: typeof formats;
  }
}
