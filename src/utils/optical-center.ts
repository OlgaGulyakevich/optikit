/**
 * Optical centring for icons — pure maths and SVG text helpers, no IO.
 *
 * A browser centres a shape by its bounding box; the eye centres it by its
 * centre of mass — where the "ink" balances. For a filled shape that point is
 * exact and computable: average the pixel positions, weighted by opacity.
 * The optical correction is the distance between the two centres.
 */

/** A point in some coordinate space (pixels or viewBox units — said at the call site). */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** An SVG `viewBox`: the canvas the icon's coordinates live in. */
export interface ViewBox {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

/** How far the ink centre sits from the canvas centre. */
export interface InkOffset {
  /** In viewBox units — what goes into `translate()`. */
  readonly units: Point;
  /** In % of the canvas side — comparable across icon sizes. */
  readonly percent: Point;
}

/**
 * - `ok` — within the threshold, leave it alone;
 * - `shift` — a filled shape, the computed correction can be applied;
 * - `check` — off-centre, but it has strokes: decorative lines (rays, sparks)
 *   count as mass, so the number may be wrong — decide by eye.
 */
export type Verdict = 'ok' | 'shift' | 'check';

/**
 * Opacity-weighted centre of a rendered alpha plane, in pixels.
 *
 * Pixel `i` covers `[i, i + 1)`, so its centre is `i + 0.5` — without that
 * half, every result drifts half a pixel up-left. Returns `undefined` for a
 * blank image (nothing to centre).
 */
export const inkCenter = (alpha: Uint8Array, width: number, height: number): Point | undefined => {
  let mass = 0;
  let sumX = 0;
  let sumY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = alpha[y * width + x] ?? 0;
      mass += a;
      sumX += a * (x + 0.5);
      sumY += a * (y + 0.5);
    }
  }

  return mass === 0 ? undefined : { x: sumX / mass, y: sumY / mass };
};

/**
 * Convert a pixel ink centre into an offset from the canvas centre.
 * Positive x = ink sits right of centre, positive y = below.
 */
export const inkOffset = (
  center: Point,
  render: { readonly width: number; readonly height: number },
  viewBox: ViewBox,
): InkOffset => {
  const fx = center.x / render.width - 0.5; // −0.5 … 0.5 of the canvas
  const fy = center.y / render.height - 0.5;
  return {
    units: { x: fx * viewBox.width, y: fy * viewBox.height },
    percent: { x: fx * 100, y: fy * 100 },
  };
};

/** Decide what to do with an icon, given its offset and whether it has strokes. */
export const verdictFor = (offset: InkOffset, thresholdPercent: number, stroked: boolean): Verdict => {
  const worst = Math.max(Math.abs(offset.percent.x), Math.abs(offset.percent.y));
  if (worst < thresholdPercent) return 'ok';
  return stroked ? 'check' : 'shift';
};

/**
 * The translate that moves the ink centre back to the canvas centre, scaled by
 * `amount` (1 = full correction). Rounded to 0.01 of a viewBox unit — finer
 * than any screen can show at icon sizes.
 */
export const correctionFor = (offset: InkOffset, amount: number): Point => {
  const round = (value: number) => Math.round(value * 100) / 100 || 0; // `|| 0` turns −0 into 0
  return { x: round(-offset.units.x * amount), y: round(-offset.units.y * amount) };
};

/** The opening `<svg …>` tag — every helper below only touches the root. */
const ROOT = /<svg\b[^>]*>/i;

/**
 * Read the root `viewBox`, falling back to numeric `width`/`height`.
 * Returns `undefined` when neither exists — such an SVG has no canvas to centre in.
 */
export const parseViewBox = (svg: string): ViewBox | undefined => {
  const root = ROOT.exec(svg)?.[0];
  if (!root) return undefined;

  const box = /\sviewBox\s*=\s*["']([^"']+)["']/i.exec(root)?.[1];
  if (box) {
    const [minX, minY, width, height] = box.trim().split(/[\s,]+/).map(Number);
    if (minX !== undefined && minY !== undefined && width && height) {
      return { minX, minY, width, height };
    }
  }

  const width = Number.parseFloat(/\swidth\s*=\s*["']([^"']+)["']/i.exec(root)?.[1] ?? '');
  const height = Number.parseFloat(/\sheight\s*=\s*["']([^"']+)["']/i.exec(root)?.[1] ?? '');
  return width > 0 && height > 0 ? { minX: 0, minY: 0, width, height } : undefined;
};

/** Replace the root's `width`/`height` so the SVG renders at exactly this pixel size. */
export const sizeForRender = (svg: string, width: number, height: number): string =>
  svg.replace(ROOT, (root) => {
    const bare = root.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '');
    return bare.replace(/^<svg\b/i, `<svg width="${width}" height="${height}"`);
  });

/** Whether any element is stroked (a `stroke` other than `none`, as attribute or style). */
export const hasStrokes = (svg: string): boolean =>
  /\sstroke\s*=\s*["'](?!none["'])[^"']+["']|[\s;"']stroke\s*:\s*(?!none\b)[^;"']+/i.test(svg);

/**
 * Wrap the icon's content in `<g transform="translate(x y)">`. svgo then bakes
 * the translate into the path coordinates, so no `transform` is left behind.
 *
 * `<title>` and `<desc>` stay first under the root: moved into the group they
 * would stop naming the SVG for screen readers.
 */
export const wrapInTranslate = (svg: string, shift: Point): string => {
  const root = ROOT.exec(svg);
  const close = svg.lastIndexOf('</svg>');
  if (!root || close === -1) return svg;

  const start = root.index + root[0].length;
  const body = svg.slice(start, close);
  const labels = body.match(/<(title|desc)\b[^>]*>[\s\S]*?<\/\1>/gi) ?? [];
  const content = labels.reduce((rest, label) => rest.replace(label, ''), body);

  return (
    svg.slice(0, start) +
    labels.join('') +
    `<g transform="translate(${shift.x} ${shift.y})">${content}</g>` +
    svg.slice(close)
  );
};
