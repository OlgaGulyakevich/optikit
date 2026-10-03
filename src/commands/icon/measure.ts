import { readFile } from 'node:fs/promises';
import { renderAlpha } from '../../tools/sharp.tool.js';
import { hasStrokes, inkCenter, inkOffset, parseViewBox, sizeForRender, type InkOffset } from '../../utils/optical-center.js';

/**
 * Render size for the longer side. At 560 px a 28-unit icon gets 20 px per
 * unit — sub-pixel anti-aliasing errors fall far below 0.01 of a unit.
 */
const RENDER_SIDE = 560;

/** Where the ink of one SVG file sits relative to its canvas centre. */
export interface Measurement {
  readonly offset: InkOffset;
  readonly stroked: boolean;
}

/**
 * Render an SVG and measure its ink offset.
 *
 * @throws Error if the SVG has no viewBox/size (no canvas to centre in) or draws nothing.
 */
export const measureIcon = async (path: string): Promise<Measurement> => {
  const svg = await readFile(path, 'utf8');
  const viewBox = parseViewBox(svg);
  if (!viewBox) {
    throw new Error(`${path}: no viewBox or width/height — nothing to centre in.`);
  }

  const scale = RENDER_SIDE / Math.max(viewBox.width, viewBox.height);
  const render = await renderAlpha(
    sizeForRender(svg, Math.round(viewBox.width * scale), Math.round(viewBox.height * scale)),
  );
  const center = inkCenter(render.alpha, render.width, render.height);
  if (!center) {
    throw new Error(`${path}: renders blank — nothing to measure.`);
  }

  return { offset: inkOffset(center, render, viewBox), stroked: hasStrokes(svg) };
};
