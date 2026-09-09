/**
 * Everything you tune after dropping new art into `src/art/`.
 *
 * `rect` values are pixel coordinates **within backdrop.png** marking where a
 * cutout belongs. That is the whole trick: each moving piece is positioned back
 * into the exact spot it was painted for, so it reads as part of the painting
 * rather than a sticker on top of it. Measure the rects in any image editor
 * once the backdrop exists.
 */

// Imported rather than referenced by path: Vite content-hashes these, so a
// rebuild produces new URLs. Files under `public/` keep one URL forever, which
// let browsers pair a fresh JS bundle with a stale painting -- new rects
// applied to old art, which looks exactly like a broken layout.
import backdropSrc from "@/art/backdrop.webp";
import treeSrc from "@/art/tree.webp";
import catSrc from "@/art/cat.png";
import cloudSrc from "@/art/cloud.png";

export type Rect = { l: number; t: number; r: number; b: number };

/** gpt-image landscape output. Change if you generate at a different size. */
export const BACKDROP = {
  src: backdropSrc,
  w: 1672,
  h: 941,
};

export const CANOPY = {
  src: treeSrc,
  /** Where the canopy sits in the backdrop. Overlaps the painted tree exactly. */
  // tree.webp is 1254x840, so this rect is 740x496 to match -- any other aspect
  // stretches the leaves.
  //
  // The generated art carried a bare trunk below the foliage, running to the
  // png's bottom edge. A rect bottom always cuts it flat, and a trunk ending in
  // mid-air is the one thing that breaks the illusion, so the asset is cropped
  // at row 840 where the last leaf ends. What remains is a branch whose bottom
  // boundary is ragged leaves, which can be cut anywhere without looking wrong.
  //
  // Two edges still have to fall outside the frame:
  //   `t` negative, so the foliage runs off the top rather than showing the
  //   png's flat top row.
  //   `r` far enough past the backdrop's 1672px width that the remaining trunk
  //   stub -- the rightmost 7% of the image, starting at x 1683 here -- stays
  //   off-frame at every viewport, including the narrow ones that pan right to
  //   FOCUS.x.narrow and see out to x~1656.
  rect: { l: 1000, t: -20, r: 1740, b: 476 } as Rect,
  /** Sway amplitude as a fraction of canopy width, so it stays proportional
   *  at every viewport size instead of growing on wide screens. */
  sway: 0.012,
};

export const CAT = {
  src: catSrc,
  /** Small, on the desk. Keep it modest -- a big cat pulls focus from the view. */
  // Measured on the current backdrop: the tabletop slab runs x 1322..1548, its
  // front edge falling from y~728 at the left corner to y~722 at the right. The
  // laptop occupies x 1400..1475.
  //
  // The rect is not the cat: opaque pixels fill 89% of cat.png's width but only
  // 52% of its height, sitting 28% down from its top. So this 100px box paints a
  // cat about 88x52 whose feet land at y~712 -- on the wood, forward of the back
  // edge, and overlapping only the laptop's lower-left corner rather than
  // lining up with it.
  rect: { l: 1318, t: 632, r: 1418, b: 732 } as Rect,
  /** Breathing depth as a fraction of height. Sleeping cats barely move;
   *  anything above ~0.02 reads as panting. */
  breath: 0.012,
};

export const CLOUD = {
  src: cloudSrc,
  /** Source pixel dimensions. World units are isotropic under the ortho
   *  camera, so height must be width / aspect or the cloud stretches. */
  w: 1254,
  h: 1254,
  count: 6,
  /** How much to brighten the cloud's shadow side, 0..1. Weighted by
   *  darkness, so highlights are untouched. */
  lift: 0.7,
  /** Clouds stay above the painted horizon. One drifting across the mountains
   *  destroys the depth instantly. Raise this if the horizon sits higher. */
  minY: 0.30,
};

/**
 * Horizontal framing, as a 0..1 position across the backdrop that stays centred
 * in view.
 *
 * A 3:2 painting in a tall phone viewport crops hard on the sides, and centring
 * throws away the desk, laptop and cat — the whole point of the scene. On
 * narrow viewports we pan toward them instead.
 */
export const FOCUS = {
  /** Horizontal anchor: the 0..1 point across the backdrop kept centred. */
  x: { wide: 0.5, narrow: 0.82, threshold: 1.1 },
  /**
   * Vertical anchor, same idea. A 3:2 painting in a wide short window (1.9+ is
   * an ordinary laptop) has to crop ~20% of its height, and centring that spends
   * the crop on the desk and cat. Anchoring below centre spends it on sky
   * instead, which carries far less of the scene.
   */
  y: 0.56,
};

/**
 * How much of the painting to show.
 *
 * Filling the frame ("cover") forces a scale of viewport_width / image_width,
 * which on a wide window blows the painting up ~20% and crops the rest. Instead
 * we scale it down until the whole thing fits, and fill the leftover margin by
 * stretching the outermost pixel column outward. The scene is banded
 * horizontally — sky, haze, hills, grass — so that stretch reads as the land
 * continuing rather than as letterbox bars.
 *
 * `maxMargin` caps how much of the frame may be stretched edge. At 0 this is
 * plain cover; at 1 the painting always fits whole however extreme the window.
 */
export const FIT = {
  maxMargin: 0,
};
