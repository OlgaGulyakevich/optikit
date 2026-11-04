/**
 * What belongs behind an icon that has to end up opaque:
 * - `opaque`: nothing to do, the source has no transparency;
 * - `plate`: the source is a solid plate with cut corners, so its colour simply continues;
 * - `no-plate`: there is nothing safe to continue, and the caller has to pick a colour.
 */
export type IconBackground =
  | { kind: 'opaque' }
  | { kind: 'plate'; color: string }
  | { kind: 'no-plate' };

/** Below this alpha a pixel counts as see-through. Above it, it is an anti-aliased rim at most. */
const SOLID_ALPHA = 250;
/** How far each channel may differ between edges and still read as one colour. */
const SAME_COLOUR = 8;

const toHex = (channels: readonly number[]) =>
  `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;

/**
 * Decide the background for a square RGBA image, one byte per channel.
 *
 * Everything inside the inscribed circle must be solid before this counts as a
 * plate. Filling transparency fills all of it, so a disc with a see-through logo
 * cut out would otherwise come back as a blank square of the disc's colour. Only
 * the corners may be empty, and then filling them cannot change the drawing.
 */
export const chooseBackground = (rgba: Uint8Array, side: number): IconBackground => {
  const inset = Math.max(1, Math.round(side * 0.02));
  const radius = side / 2 - inset;
  const alphaAt = (x: number, y: number) => rgba[(y * side + x) * 4 + 3] ?? 0;

  let transparent = false;
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const alpha = alphaAt(x, y);
      if (alpha === 255) continue;
      transparent = true;
      const insideCircle = Math.hypot(x + 0.5 - side / 2, y + 0.5 - side / 2) <= radius;
      if (alpha < SOLID_ALPHA && insideCircle) return { kind: 'no-plate' };
    }
  }
  if (!transparent) return { kind: 'opaque' };

  // The four edge midpoints, just inside the rim: one colour, or a fill would show a seam.
  const middle = Math.floor(side / 2);
  const far = side - 1 - inset;
  const [first, ...others] = [
    [middle, inset],
    [middle, far],
    [inset, middle],
    [far, middle],
  ].map(([x = 0, y = 0]) => Array.from(rgba.subarray((y * side + x) * 4, (y * side + x) * 4 + 3)));
  if (!first) return { kind: 'no-plate' };

  const sameColour = others.every((sample) =>
    sample.every((channel, i) => Math.abs(channel - (first[i] ?? 0)) <= SAME_COLOUR),
  );
  return sameColour ? { kind: 'plate', color: toHex(first) } : { kind: 'no-plate' };
};
