import { getSite } from "@/content/site";
import type { Locale } from "@/i18n/routing";

import { fromAddressOverride, recipientsOverride } from "./env";

/**
 * Who the notification comes from and where it goes (07 `D-07.10`, §5).
 *
 * The addresses are **content**, in `content/site.json`, with the environment
 * as a per-environment override — not the other way round. That is the whole
 * point of `D-07.10`: the owner edits one file and sees the address they will
 * keep, and no address is ever a literal in `src/` (INV-07.3, INV-07.9).
 *
 * | What | Resolution order |
 * | --- | --- |
 * | `from` address | `INQUIRY_FROM_EMAIL` → `email.fromAddress` |
 * | `from` display name | `brand.name[<render locale>]` — no env, no literal |
 * | sending domain | `email.sendingDomain` — no env form at all |
 * | `to` recipients | `INQUIRY_TO_EMAIL` → `email.notifyTo` → `contact.email` |
 *
 * The render locale is the locale the *message* is written in, so the staff
 * notification signs itself in English and the parent's acknowledgement in the
 * parent's language, without a second copy of the brand name anywhere.
 *
 * Nothing here can send today, and that is the designed state. The sample
 * sending domain is unverified in Resend until the human publishes its DKIM and
 * SPF records, so step 7 answers a loud 502 rather than delivering from an
 * address nobody owns — §2 of 07 spells that out, and the three sample values
 * sit in `site.json`'s `provisional` array so `validate:content --release`
 * refuses to launch while they remain.
 */

export type SendingIdentity = {
  /** RFC 5322 `From`: `"Green Pastures Montessori Daycare" <no-reply@…>`. */
  readonly from: string;
  /** The bare address, without the display name — for logs and assertions. */
  readonly fromAddress: string;
  /** The display name as it will appear, before quoting. */
  readonly displayName: string;
  /** One or more recipients; the override may name several. */
  readonly to: readonly string[];
  /** The domain Resend must have verified for `from` to be accepted. */
  readonly sendingDomain: string;
};

/**
 * Quote a display name for a mail header.
 *
 * A quoted string may not contain a bare `"` or `\`, and by the time this runs
 * the name is a brand name from `site.json` that the content schema has already
 * proved to be plain text — so this is a guard against a future edit, not
 * against a submission. A non-ASCII name (优朵幼儿园) is left as-is: the
 * transport encodes it (A-07.6, confirm on the first real send).
 */
function quoteDisplayName(name: string): string {
  return `"${name.replace(/[\\"]/g, (character) => `\\${character}`)}"`;
}

/**
 * Resolve the sending identity for a message rendered in `renderLocale`.
 *
 * `site` is a parameter with a default rather than a direct call so a test can
 * state the resolution order against a synthetic config without writing to
 * `content/site.json` — the same shape `src/content/site.ts` returns.
 */
export function resolveSendingIdentity(
  renderLocale: Locale,
  site: ReturnType<typeof getSite> = getSite(),
): SendingIdentity {
  const fromAddress = fromAddressOverride() ?? site.email.fromAddress;
  const displayName = site.brand.name[renderLocale] ?? site.brand.name.en;
  const to = recipientsOverride() ?? [site.email.notifyTo ?? site.contact.email];

  return {
    from: `${quoteDisplayName(displayName)} <${fromAddress}>`,
    fromAddress,
    displayName,
    to,
    sendingDomain: site.email.sendingDomain,
  };
}
