import { useTranslations } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { RevealSide } from "@/components/motion/variants";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import type { TestimonialEntry } from "@/content/collections";

import { Bubble } from "./Bubble";
import { BUBBLE_ATTRIBUTION, BUBBLE_AVATAR, BUBBLE_BODY } from "./layout";
import { StarRow } from "./StarRow";

/**
 * One review (04 §3.5; D L245–252, M L173–179).
 *
 * `<figure>` → stars, `<blockquote>`, `<figcaption>`. The figure sits inside
 * the `<li>` {@link Bubble} draws so that the list semantics and the quote
 * semantics are each carried by the element that means them.
 *
 * ── The quotation marks are punctuation, not part of the quote ────────────
 *
 * `common.punctuation.quoteOpen` / `quoteClose` supply them, which is 02's
 * reason for the keys: the marks a locale uses are the locale's, and a stored
 * quote that carried its own would freeze `en`'s choice into all three. The
 * collection value is the words alone.
 *
 * ── The `<em>` inside a quote, and why it is renderable here ──────────────
 *
 * `collections.testimonials.<id>.quote` is `RichText`, and Mei L.'s carries
 * `<em>see</em>` — the design's italic (D L247). Collection text never passes
 * through `t.rich`, so 02's usual "markup is rendered by `t.rich`, never
 * stored" has no renderer on this path: `richTags()` (`D-04.13`,
 * `components/ui/rich.tsx`) is the component that will own it and is not built
 * yet. {@link renderRichText} below is the minimum that renders the one shape
 * the schema actually admits today, and it throws rather than guess on any
 * other tag — so the day a `<link>` appears in a quote, this file fails loudly
 * instead of printing angle brackets.
 *
 * The `<em>` takes no classes. `D-04.13` maps `em` to `--section-accent`, and
 * 03 §2.3 prints "—" for testimonials, so `Section` leaves that variable unset
 * and the word inherits the quote's ink at the browser's default italic —
 * which is exactly what the reference draws.
 *
 * ── The avatar ────────────────────────────────────────────────────────────
 *
 * Both references draw an `image-slot` here, and 04 §10 asks 02 for an optional
 * `site.testimonials[].avatar`; `src/content/schemas/testimonials.ts` does not
 * carry one, so every bubble reserves the box as a `PhotoSlot` circle. It has
 * no `alt` and is therefore `aria-hidden` (04 §3.2), which is right: the name
 * it decorates is the next thing in the reading order.
 */

/* -------------------------------------------------------------------------- *
 * Rich text
 * -------------------------------------------------------------------------- */

/**
 * The two purely presentational tags of 02 `D-02.5`'s allowlist — the only ones
 * a stored value can render without a call-site argument (`<link>` needs an
 * href, `<count>` a number, `<day>` a weekday).
 */
const PRESENTATIONAL_TAG = /<(em|strong)>([\s\S]*?)<\/\1>/gu;

/** Anything still tag-shaped after the pair above has been taken out. */
const ANY_TAG = /<\/?[A-Za-z][^>]*>/u;

const WRAP = {
  em: (children: ReactNode) => <em>{children}</em>,
  strong: (children: ReactNode) => <strong>{children}</strong>,
} as const;

function isPresentationalTag(tag: string): tag is keyof typeof WRAP {
  return Object.hasOwn(WRAP, tag);
}

/**
 * Render a `RichText` collection value's `<em>` / `<strong>` as elements.
 *
 * Deliberately tiny and deliberately closed: it is a placeholder for
 * `richTags()` (`D-04.13`), not a second markup pipeline. A tag outside the
 * pair throws, because the alternative — rendering it as text — puts angle
 * brackets on the page and nobody finds out.
 */
export function renderRichText(value: string, source: string): readonly ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of value.matchAll(PRESENTATIONAL_TAG)) {
    const [token, tag, inner] = match;
    if (tag === undefined || inner === undefined || !isPresentationalTag(tag)) continue;

    if (match.index > cursor) nodes.push(value.slice(cursor, match.index));
    nodes.push(<Fragment key={`${tag}-${String(match.index)}`}>{WRAP[tag](inner)}</Fragment>);
    cursor = match.index + token.length;
  }

  const tail = value.slice(cursor);
  if (tail !== "") nodes.push(tail);

  if (nodes.some((node) => typeof node === "string" && ANY_TAG.test(node))) {
    throw new Error(
      `${source} carries a rich tag this section cannot render. Only <em> and <strong> ` +
        `resolve without a call-site argument; the rest belong to richTags() (04 D-04.13).`,
    );
  }

  return nodes;
}

/* -------------------------------------------------------------------------- *
 * The component
 * -------------------------------------------------------------------------- */

/**
 * The quote: Nunito 600 at `--text-testimonial` (14px/1.6, 16px `≥ md`) on
 * `--section-sub`, which resolves to `--color-sub-testimonials` — 03 §2.3's
 * "quote — the bubble body on white". Both are exactly the reference's values.
 */
const QUOTE = "font-body text-testimonial font-semibold text-(color:--section-sub)";

/**
 * The reviewer's name: Nunito 700 on `--color-ink` (D L250, M L177). 03 §3.2
 * records 13px / 14px inside the `--text-testimonial` row without minting a
 * name, so this takes Tailwind's own `sm` step (14px) on both views — exact on
 * desktop, one px up on mobile — rather than inventing a px (INV-03.2).
 */
const AUTHOR = "font-body text-sm font-bold text-ink";

/**
 * The relation line: Nunito 600 on `--color-sub-testimonials-attribution`, the
 * token 03 §2.3 minted for exactly this line ("reviewer relation line, on
 * white — desktop L251"). 11px / 12px is again inside the `--text-testimonial`
 * row, so `text-xs` (12px) stands on both views.
 */
const RELATION = "font-body text-xs font-semibold text-sub-testimonials-attribution";

export type SpeechBubbleProps = {
  /** One joined `site.testimonials[]` entry and its per-locale text. */
  readonly item: TestimonialEntry;
  /** DOM position in the stagger group; picks the tail and the entrance origin. */
  readonly index: number;
  /** Extra classes on the card — the centre column's push. */
  readonly className?: string;
};

/**
 * Which side the tail is on. The desktop reference alternates L · R · L across
 * the three cards (D L245, L253, L261) and the mobile one alternates across its
 * two (M L173, L177) — one rule, index parity, on both views.
 */
export function tailFor(index: number): RevealSide {
  return index % 2 === 0 ? "left" : "right";
}

export function SpeechBubble({ item, index, className }: SpeechBubbleProps) {
  const t = useTranslations("common.punctuation");

  return (
    <Bubble tail={tailFor(index)} index={index} desktopOnly={!item.onMobile} className={className}>
      <figure data-testimonial={item.id} className={BUBBLE_BODY}>
        <StarRow />

        <blockquote className={QUOTE}>
          <p>
            {t("quoteOpen")}
            {renderRichText(item.text.quote, `collections.testimonials.${item.id}.quote`)}
            {t("quoteClose")}
          </p>
        </blockquote>

        <figcaption className={BUBBLE_ATTRIBUTION}>
          <PhotoSlot slotId={item.id} shape="circle" className={BUBBLE_AVATAR} />
          <div>
            <div className={AUTHOR}>{item.text.author}</div>
            <div className={RELATION}>{item.text.relation}</div>
          </div>
        </figcaption>
      </figure>
    </Bubble>
  );
}
