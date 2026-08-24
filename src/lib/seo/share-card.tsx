import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ReactElement } from "react";

import { getSite } from "@/content/site";
import { cssToken } from "@/design/css-tokens";

/**
 * The share card `/og/placeholder.png` draws — the interim Open Graph image
 * (06 §6.5, `OQ-06.7`).
 *
 * ── What this is, and what it is not ─────────────────────────────────────
 *
 * `OQ-06.7` assigns the real 1200×630 artwork to the design owner and is still
 * open. This is the placeholder 06 §6.5 and 12 both say ships until then — "a
 * logo-on-cream placeholder" — and `content/site.json` registers
 * `images.og.src` in `provisional` so `pnpm validate:content --release` refuses
 * to launch while the site is still pointing at it (`D-02.20`, INV-02.10). The
 * path says `placeholder` for the same reason: `/og/cover.png` stays reserved
 * for the artwork, as a real file under `public/`, so the day it arrives the
 * change is "commit the PNG, point the value back, delete this route" and not a
 * route quietly shadowing a static file at the same URL.
 *
 * 12's default answer to `OQ-06.7` is "a logo-on-cream placeholder is generated
 * once and committed". This is that placeholder, generated on **every** build
 * rather than once — the difference is deliberate. Committed bytes are a binary
 * nobody can re-derive from this repository, and they would keep their colours
 * after `tokens.css` changed its. Rendering at build keeps the card a function
 * of the wordmark and the token file, which is the only reason it is allowed to
 * name colours at all.
 *
 * ── Why there is no text on it ───────────────────────────────────────────
 *
 * Satori draws text from font *binaries* and takes `ttf`/`otf`/`woff` only.
 * `next/font/google` self-hosts Fredoka and Nunito as `woff2` under
 * `/_next/static/media`, and `D-03.5` deliberately loads no CJK face at all, so
 * there is no path from this repository's fonts to this canvas. Setting the
 * brand name in `next/og`'s bundled fallback face would put the centre's name
 * on every shared link in a typeface that is not the centre's — worse than not
 * setting it.
 *
 * `public/brand/logo.png` is the wordmark (`D-03.9`) and it already carries the
 * name three ways: "Green Pastures", "Montessori Daycare" and 优朵幼儿园. So the
 * card shows the wordmark and nothing else, which is also the answer to the
 * per-locale question — see the note on the route.
 *
 * ── Where the values come from ───────────────────────────────────────────
 *
 * Nothing below is invented. The canvas is `site.json` `images.og`, so the
 * bytes cannot disagree with the `og:image:width` / `og:image:height` the
 * metadata declares. Every colour, the card radius and its shadow are read out
 * of `src/styles/tokens.css` through {@link cssToken} (INV-03.1). The logo's
 * aspect ratio is read from the PNG itself rather than restated, so replacing
 * the file cannot stretch it.
 *
 * The remaining numbers are the composition — where the sun sits, how wide the
 * meadow is. 03 mints no token for the geometry of a 1200×630 canvas that
 * exists in no viewport, and INV-03.2 is a rule about component sizing, so
 * these are plain numbers in one file, named.
 */

/** `public/brand/logo.png`, the wordmark of `D-03.9`. */
const LOGO_FILE = join("public", "brand", "logo.png");

/** The eight-byte PNG signature every valid file starts with. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Where `IHDR` puts the two 32-bit big-endian dimensions. */
const IHDR_WIDTH_OFFSET = 16;
const IHDR_HEIGHT_OFFSET = 20;

/** How wide the wordmark is drawn; its height follows from the file. */
const LOGO_WIDTH = 620;

/** The white card the wordmark sits in — 03 §9's idiom, at this scale. */
const CARD_PADDING_Y = 48;
const CARD_PADDING_X = 84;

/** How far the card is lifted off centre, to clear the meadow below it. */
const CARD_LIFT = 88;

/** The sun, a corner of it in the top right and the rest off-canvas. */
const SUN_SIZE = 360;
const SUN_TOP = -140;
const SUN_RIGHT = -120;
const SUN_OPACITY = 0.6;

/**
 * The meadow: two ellipses cropped by the bottom edge. The far one is forest at
 * half strength — a hill behind the near one rather than a second colour.
 */
const MEADOW_WIDTH = 1440;
const MEADOW_HEIGHT = 420;
const MEADOW_LEFT = -120;
const MEADOW_BOTTOM = -300;
const FAR_MEADOW_WIDTH = 980;
const FAR_MEADOW_HEIGHT = 480;
const FAR_MEADOW_RIGHT = -220;
const FAR_MEADOW_BOTTOM = -320;
const FAR_MEADOW_OPACITY = 0.5;

/** A round shape in Satori is a border radius of half its box. */
const ELLIPSE = "50%";

/**
 * The intrinsic size of a PNG, read from its `IHDR` chunk.
 *
 * `D-03.9` states the logo is 373×161 and `LogoCard` passes those numbers to
 * `next/image` because the browser needs them before the file arrives. Here the
 * file is already in hand, so restating them would only create a second place
 * to be wrong: the card would keep drawing a 373:161 box after someone replaced
 * the wordmark with a squarer one.
 */
export function pngSize(bytes: Buffer): { readonly width: number; readonly height: number } {
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${LOGO_FILE} is not a PNG (03 D-03.9).`);
  }
  return {
    width: bytes.readUInt32BE(IHDR_WIDTH_OFFSET),
    height: bytes.readUInt32BE(IHDR_HEIGHT_OFFSET),
  };
}

/** The canvas, from `site.json` — the same pair the Open Graph tags declare. */
export function shareCardSize(): { readonly width: number; readonly height: number } {
  const { width, height } = getSite().images.og;
  return { width, height };
}

/**
 * The card, as the element `ImageResponse` renders.
 *
 * Satori needs `display` on every box that has children, and supports flexbox
 * and absolute positioning only — no grid, no float. The three decorative
 * layers are absolutely positioned siblings under one centred flex row.
 */
export function shareCard(): ReactElement {
  const logo = readFileSync(join(process.cwd(), LOGO_FILE));
  const { width: logoWidth, height: logoHeight } = pngSize(logo);
  const logoBox = {
    width: LOGO_WIDTH,
    height: Math.round((LOGO_WIDTH * logoHeight) / logoWidth),
  };
  const { width, height } = shareCardSize();

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width,
        height,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: cssToken("--color-cream"),
      }}
    >
      <div
        style={{
          position: "absolute",
          display: "flex",
          top: SUN_TOP,
          right: SUN_RIGHT,
          width: SUN_SIZE,
          height: SUN_SIZE,
          borderRadius: ELLIPSE,
          opacity: SUN_OPACITY,
          backgroundColor: cssToken("--color-sun"),
        }}
      />
      <div
        style={{
          position: "absolute",
          display: "flex",
          right: FAR_MEADOW_RIGHT,
          bottom: FAR_MEADOW_BOTTOM,
          width: FAR_MEADOW_WIDTH,
          height: FAR_MEADOW_HEIGHT,
          borderRadius: ELLIPSE,
          opacity: FAR_MEADOW_OPACITY,
          backgroundColor: cssToken("--color-forest"),
        }}
      />
      <div
        style={{
          position: "absolute",
          display: "flex",
          left: MEADOW_LEFT,
          bottom: MEADOW_BOTTOM,
          width: MEADOW_WIDTH,
          height: MEADOW_HEIGHT,
          borderRadius: ELLIPSE,
          backgroundColor: cssToken("--color-sage"),
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          marginBottom: CARD_LIFT,
          padding: `${String(CARD_PADDING_Y)}px ${String(CARD_PADDING_X)}px`,
          borderRadius: cssToken("--radius-card-lg"),
          backgroundColor: cssToken("--color-white"),
          boxShadow: cssToken("--shadow-float"),
        }}
      >
        <div
          style={{
            display: "flex",
            width: logoBox.width,
            height: logoBox.height,
            backgroundImage: `url(data:image/png;base64,${logo.toString("base64")})`,
            backgroundSize: `${String(logoBox.width)}px ${String(logoBox.height)}px`,
            backgroundRepeat: "no-repeat",
          }}
        />
      </div>
    </div>
  );
}
