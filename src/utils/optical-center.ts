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

/** A box in viewBox units: where the ink actually is. */
export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
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
 * Bounding box of the ink, in pixels (pixel `i` spans `[i, i + 1)`).
 * Every pixel with any coverage counts. A sharp tip covers its last pixels
 * only partly — drop those and the box comes up short, the grown canvas ends
 * just before the tip, and the tip gets cut. Erring a fraction of a pixel wide
 * is the safe direction.
 */
export const inkBounds = (alpha: Uint8Array, width: number, height: number): Bounds | undefined => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((alpha[y * width + x] ?? 0) === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + 1);
      maxY = Math.max(maxY, y + 1);
    }
  }

  return minX === Infinity ? undefined : { minX, minY, maxX, maxY };
};

/** A canvas grown by `share` of its longer side on every edge. */
export const padViewBox = (box: ViewBox, share: number): ViewBox => {
  const pad = Math.max(box.width, box.height) * share;
  return { minX: box.minX - pad, minY: box.minY - pad, width: box.width + 2 * pad, height: box.height + 2 * pad };
};

/** Pixel coordinates of a render of `box` → viewBox units. */
export const toUnits = (point: Point, render: { readonly width: number; readonly height: number }, box: ViewBox): Point => ({
  x: box.minX + (point.x / render.width) * box.width,
  y: box.minY + (point.y / render.height) * box.height,
});

/**
 * Offset of the ink centre (viewBox units) from the canvas centre.
 * Positive x = ink sits right of centre, positive y = below.
 */
export const inkOffset = (ink: Point, viewBox: ViewBox): InkOffset => {
  const x = ink.x - (viewBox.minX + viewBox.width / 2);
  const y = ink.y - (viewBox.minY + viewBox.height / 2);
  return {
    units: { x, y },
    percent: { x: (x / viewBox.width) * 100, y: (y / viewBox.height) * 100 },
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

/**
 * How a correction gets into the file:
 * - `translate` — the drawing moves inside its canvas (it fits);
 * - `viewBox` — the drawing would cross the edge, so the canvas grows and
 *   re-centres on the target instead. Same visual result, nothing cut off —
 *   but in the same CSS box the drawing renders smaller by `shrink` (0–1).
 */
export type FixPlan =
  | { readonly kind: 'translate'; readonly shift: Point }
  | { readonly kind: 'viewBox'; readonly shift: Point; readonly viewBox: ViewBox; readonly shrink: number };

/**
 * Choose how to apply `shift` without cutting the drawing. `ink` is where the
 * drawing really is (measured on a padded canvas); `tolerance` absorbs
 * rendering error so a shape exactly on the edge still counts as fitting.
 *
 * The grown canvas is centred where the shift says the eye wants the centre,
 * and is never smaller than the original on either axis — it only zooms out.
 */
export const planFix = (ink: Bounds, box: ViewBox, shift: Point, tolerance: number): FixPlan => {
  const fits =
    ink.minX + shift.x >= box.minX - tolerance &&
    ink.maxX + shift.x <= box.minX + box.width + tolerance &&
    ink.minY + shift.y >= box.minY - tolerance &&
    ink.maxY + shift.y <= box.minY + box.height + tolerance;
  if (fits) return { kind: 'translate', shift };

  // Moving the drawing by +shift ≡ moving the canvas centre by −shift.
  const cx = box.minX + box.width / 2 - shift.x;
  const cy = box.minY + box.height / 2 - shift.y;
  const halfW = Math.max(box.width / 2, cx - ink.minX, ink.maxX - cx);
  const halfH = Math.max(box.height / 2, cy - ink.minY, ink.maxY - cy);

  const down = (value: number) => Math.floor(value * 100) / 100; // round outward:
  const up = (value: number) => Math.ceil(value * 100) / 100; // never trim ink
  const minX = down(cx - halfW);
  const minY = down(cy - halfH);
  const viewBox = { minX, minY, width: up(cx + halfW) - minX, height: up(cy + halfH) - minY };
  const round = (value: number) => Math.round(value * 100) / 100;

  return {
    kind: 'viewBox',
    shift,
    viewBox: { minX: round(viewBox.minX), minY: round(viewBox.minY), width: round(viewBox.width), height: round(viewBox.height) },
    shrink: 1 - Math.min(box.width / viewBox.width, box.height / viewBox.height),
  };
};

/**
 * Check a fixed icon against what the fix promised. Measured on a padded
 * canvas, so this can actually fail: ink past the edge shows up as ink past
 * the edge, not as a clipped drawing that happens to look centred.
 *
 * @param expected - where the ink centre should land, relative to the new canvas centre
 * @returns why the fix failed, or `undefined` when it holds
 */
export const verifyFix = (
  expected: Point,
  after: { readonly offset: InkOffset; readonly ink: Bounds; readonly viewBox: ViewBox },
  tolerance: number,
): string | undefined => {
  const { ink, viewBox: box } = after;
  if (
    ink.minX < box.minX - tolerance ||
    ink.minY < box.minY - tolerance ||
    ink.maxX > box.minX + box.width + tolerance ||
    ink.maxY > box.minY + box.height + tolerance
  ) {
    return 'the drawing crosses the canvas edge — it would be cut off';
  }

  const { x, y } = after.offset.units;
  if (Math.abs(x - expected.x) > tolerance || Math.abs(y - expected.y) > tolerance) {
    return `ink centre landed at (${x.toFixed(2)}, ${y.toFixed(2)}), expected (${expected.x.toFixed(2)}, ${expected.y.toFixed(2)})`;
  }
  return undefined;
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

/** Set (or add) the root `viewBox`. */
export const withViewBox = (svg: string, box: ViewBox): string =>
  svg.replace(ROOT, (root) => {
    const value = `${box.minX} ${box.minY} ${box.width} ${box.height}`;
    return /\sviewBox\s*=/i.test(root)
      ? root.replace(/(\sviewBox\s*=\s*)(["'])[^"']*\2/i, `$1"${value}"`)
      : root.replace(/^<svg\b/i, `<svg viewBox="${value}"`);
  });

/** `--amount` as written in the mark: `full`, `half`, or the number. */
export const formatAmount = (amount: number): string =>
  amount === 1 ? 'full' : amount === 0.5 ? 'half' : String(amount);

/**
 * The `data-optical` mark on the root: "this icon was centred on purpose, at
 * this strength". Returns the strength, or `undefined` when unmarked or garbled.
 * A data attribute, not a comment — svgo strips comments and keeps `data-*`.
 */
export const readOpticalMark = (svg: string): number | undefined => {
  const value = /\sdata-optical\s*=\s*["']([^"']+)["']/i.exec(ROOT.exec(svg)?.[0] ?? '')?.[1];
  if (value === undefined) return undefined;
  if (value === 'full') return 1;
  if (value === 'half') return 0.5;
  const amount = Number(value);
  return amount > 0 && amount <= 1 ? amount : undefined;
};

/** Set (or replace) the `data-optical` mark on the root. */
export const writeOpticalMark = (svg: string, amount: number): string =>
  svg.replace(ROOT, (root) => {
    const bare = root.replace(/\sdata-optical\s*=\s*["'][^"']*["']/i, '');
    return bare.replace(/^<svg\b/i, `<svg data-optical="${formatAmount(amount)}"`);
  });

/** Apply a fix plan to SVG text: move the drawing, or grow and re-centre the canvas. */
export const applyFixPlan = (svg: string, plan: FixPlan): string =>
  plan.kind === 'translate' ? wrapInTranslate(svg, plan.shift) : withViewBox(svg, plan.viewBox);

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
