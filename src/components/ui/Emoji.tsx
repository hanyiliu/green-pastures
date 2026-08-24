import { withOverrides } from "./class-names";
import { imageRole } from "./image-role";

/**
 * The emoji icon (03 `D-03.8`, §9; 04 §3.2).
 *
 * Emoji stay the icon language of the site, and the glyphs come from the
 * platform: Apple, Segoe and Noto draw them at different widths. So the two
 * *container* sizes are fixed boxes (03 §9: 48px tiles, 56/48px icon dots), and
 * the glyph is centred inside — a font-stack change can never reflow the row
 * around it. The `inline` size has no box on purpose: an emoji inside a
 * sentence has to advance with the text.
 *
 * Accessibility follows 04 §3.2: with a `label` the span is `role="img"` and
 * carries it as the accessible name; without one it is `aria-hidden`, which is
 * the right answer whenever the neighbouring words already say what the icon
 * says. The label is always a message value — never a literal (INV-02.1).
 * `PhotoSlot` keeps the identical rule, so the branch itself lives once in
 * `components/ui/image-role.tsx` and both primitives spread its answer.
 */

const SIZE = {
  /** The teachers' white icon circle — 48px `< md`, 56px `≥ md` (03 §9). */
  dot: "size-12 text-2xl md:size-14 md:text-3xl",
  /** The principle tiles — 48px on both views (03 §9). */
  tile: "size-12 text-2xl",
  /** Inside a line of text: no box, no size of its own. */
  inline: "",
} as const;

export type EmojiSize = keyof typeof SIZE;

export type EmojiProps = {
  /** The glyph itself, from a `site.json` `icon` field. */
  readonly symbol: string;
  /** An accessible name from the message tree. Omit when the icon is decorative. */
  readonly label?: string;
  readonly size?: EmojiSize;
  /** Extra classes; an override of a property the recipe sets must be important (`size-8!`). */
  readonly className?: string;
};

export function Emoji({ symbol, label, size = "inline", className }: EmojiProps) {
  return (
    <span
      {...imageRole(label)}
      className={withOverrides(
        "Emoji",
        `inline-flex items-center justify-center font-emoji leading-none ${SIZE[size]}`,
        className,
      )}
    >
      {symbol}
    </span>
  );
}
