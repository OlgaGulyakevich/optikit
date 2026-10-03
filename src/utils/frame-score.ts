/**
 * Choosing a poster frame — pure maths, no IO.
 *
 * The first frame is usually the worst candidate: a fade from black, motion
 * blur, the person not yet in shot. We sample the whole clip instead, drop
 * frames that are too dark or blown out, and prefer the sharpest. "Best" in
 * the human sense (a smile, the product in focus) is taste — which is why
 * `--candidates` exists: the maths narrows it down, a person picks.
 */

/** Measurements of one sampled frame. */
export interface FrameStats {
  /** Seconds from the start of the clip. */
  readonly time: number;
  /** Mean luminance, 0 (black) – 255 (white). */
  readonly brightness: number;
  /** Variance of the Laplacian — higher = more crisp edges, less blur. */
  readonly sharpness: number;
}

/** Below this mean a frame reads as black (fades, dark openings). */
const TOO_DARK = 20;
/** Above this mean it reads as a white flash or blown-out exposure. */
const TOO_BRIGHT = 235;

/**
 * Brightness and sharpness of a greyscale frame (one byte per pixel).
 *
 * Sharpness is the variance of the 4-neighbour Laplacian: the Laplacian is
 * near zero on flat areas and spikes on edges, so a crisp frame has a wide
 * spread of values and a blurred one a narrow spread. A standard, cheap blur
 * metric — no model, no training.
 */
export const frameStats = (gray: Uint8Array, width: number, height: number, time: number): FrameStats => {
  let sum = 0;
  for (const value of gray) sum += value;
  const brightness = gray.length === 0 ? 0 : sum / gray.length;

  let count = 0;
  let mean = 0;
  let squares = 0;
  const at = (x: number, y: number) => gray[y * width + x] ?? 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const laplacian = at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1) - 4 * at(x, y);
      count += 1;
      mean += laplacian;
      squares += laplacian * laplacian;
    }
  }

  const sharpness = count === 0 ? 0 : squares / count - (mean / count) ** 2;
  return { time, brightness, sharpness };
};

/** Neither black nor blown out. */
export const isUsable = (frame: FrameStats): boolean =>
  frame.brightness >= TOO_DARK && frame.brightness <= TOO_BRIGHT;

/**
 * The part of the clip worth sampling: 5% to 95% — skipping the very start
 * (fade-ins, black leader) and the very end (fade-outs, and a seek past the
 * last frame returns nothing).
 */
export const sampleWindow = (duration: number): { start: number; span: number } => ({
  start: duration * 0.05,
  span: duration * 0.9,
});

/**
 * Times of `count` evenly spaced samples inside the window — the same ticks
 * ffmpeg's `fps=count/span` filter emits, so frame `i` of its output is `times[i]`.
 */
export const sampleTimes = (duration: number, count: number): number[] => {
  const { start, span } = sampleWindow(duration);
  return Array.from({ length: count }, (_, i) => start + (i * span) / count);
};

/** Sharpest usable frame; if every frame is dark or blown out, the sharpest overall. */
export const pickBest = (frames: readonly FrameStats[]): FrameStats | undefined => {
  const usable = frames.filter(isUsable);
  const pool = usable.length > 0 ? usable : frames;
  return pool.reduce<FrameStats | undefined>(
    (best, frame) => (best === undefined || frame.sharpness > best.sharpness ? frame : best),
    undefined,
  );
};

/**
 * `n` good frames from different parts of the clip: split the (time-ordered)
 * samples into `n` consecutive groups and take the best of each. Without the
 * split, the top `n` by sharpness would often be neighbours from one scene.
 */
export const pickSpread = (frames: readonly FrameStats[], n: number): FrameStats[] => {
  const sorted = [...frames].sort((a, b) => a.time - b.time);
  const picks: FrameStats[] = [];

  for (let i = 0; i < n; i++) {
    const group = sorted.slice(Math.floor((i * sorted.length) / n), Math.floor(((i + 1) * sorted.length) / n));
    const best = pickBest(group);
    if (best) picks.push(best);
  }

  return picks;
};

/**
 * Parse a time given on the command line: `4.2`, `1:05`, `00:04.2`, `01:02:03.5`.
 *
 * @throws Error on anything else — a typo must not silently become frame 0.
 */
export const parseTimecode = (text: string): number => {
  const parts = text.trim().split(':');
  const valid =
    parts.length <= 3 &&
    parts.every((part) => /^\d+(\.\d+)?$/.test(part)) &&
    // Only the leading part may exceed 59: `90` seconds is fine, `1:90` is a typo.
    parts.slice(1).every((part) => Number(part) < 60);
  if (!valid) {
    throw new Error(`Invalid time "${text}" — use seconds (4.2) or mm:ss / hh:mm:ss (00:04.2).`);
  }
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
};

/** Seconds → `mm:ss.s` (or `h:mm:ss.s`) — the form `--at` accepts back. */
export const formatTimecode = (seconds: number): string => {
  const tenths = Math.round(seconds * 10);
  const hours = Math.floor(tenths / 36_000);
  const minutes = Math.floor((tenths % 36_000) / 600);
  const secs = (tenths % 600) / 10;
  const mmss = `${String(minutes).padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
};
