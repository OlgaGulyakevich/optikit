import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderAlpha } from '../../tools/sharp.tool.js';
import { parseViewBox, sizeForRender } from '../../utils/optical-center.js';
import { runAudit } from './audit.command.js';

/**
 * Pixels drawn OUTSIDE the SVG's own viewBox — i.e. what a browser would cut
 * off. Rendered on a canvas with a wide margin, so clipped ink is still visible
 * here; measuring inside the viewBox alone would hide exactly the bug we test.
 */
const inkOutsideCanvas = async (svg: string): Promise<number> => {
  const box = parseViewBox(svg);
  if (!box) throw new Error('no viewBox');
  const pad = Math.max(box.width, box.height);
  const padded = svg.replace(
    /viewBox="[^"]*"/,
    `viewBox="${box.minX - pad} ${box.minY - pad} ${box.width + 2 * pad} ${box.height + 2 * pad}"`,
  );
  const scale = 20; // px per viewBox unit
  const { alpha, width, height } = await renderAlpha(
    sizeForRender(padded, (box.width + 2 * pad) * scale, (box.height + 2 * pad) * scale),
  );

  let outside = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Pixel x spans [x, x + 1). A canvas edge can fall mid-pixel (−4.66 units
      // → 373.2 px): only a pixel ENTIRELY past the edge is ink the browser cuts.
      const left = pad * scale;
      const top = pad * scale;
      const right = (pad + box.width) * scale;
      const bottom = (pad + box.height) * scale;
      const overlaps = x + 1 > left && x < right && y + 1 > top && y < bottom;
      if (!overlaps && (alpha[y * width + x] ?? 0) > 0) outside += 1;
    }
  }
  return outside;
};

describe('icon audit --fix', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'optikit-audit-'));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it('never pushes the drawing off a tight canvas', async () => {
    // A play-like wedge touching the left, top and bottom edges: its mass sits
    // left of centre, so the correction moves it right — past the right edge
    // unless the canvas grows (the Telegram icon on Yulia's site, 05.10.2026).
    const input = join(dir, 'wedge.svg');
    await writeFile(input, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 12"><path d="M0 0L14 6L0 12Z"/></svg>');

    await runAudit({ input, fix: true, amount: 'full', out: join(dir, 'out') });

    const fixed = await readFile(join(dir, 'out', 'wedge.svg'), 'utf8');
    expect(await inkOutsideCanvas(fixed)).toBe(0);
  });

  it('marks a fixed icon and never fixes it twice', async () => {
    // A triangle centred by its box: ink sits 1 unit high on a 28 canvas.
    const input = join(dir, 'triangle.svg');
    await writeFile(input, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><path d="M3.5 7.5H24.5L14 24Z"/></svg>');
    const first = join(dir, 'first');
    const second = join(dir, 'second');

    await runAudit({ input, fix: true, out: first }); // default strength
    const fixed = await readFile(join(first, 'triangle.svg'), 'utf8');
    expect(fixed).toContain('data-optical="half"');
    expect(fixed).toContain('M3.5 8h21L14 24.5Z'); // half of translate(0 1), baked into the path

    // Auditing the fixed copy: 50% of the offset is left by design — not "to shift".
    await runAudit({ input: join(first, 'triangle.svg'), fix: true, out: second });
    await expect(readFile(join(second, 'triangle.svg'), 'utf8')).rejects.toThrow(/ENOENT/);
  });
});
