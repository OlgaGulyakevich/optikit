/**
 * WebP quality → the AVIF quality that looks the same. The two scales only share
 * their numbers: at 85 AVIF came out up to 2.7x heavier than WebP, while the
 * equivalent AVIF is about 30–45% lighter. Median of an SSIM match over three sample
 * photos, with 85 → 55 also compared by eye. SSIM alone is not the verdict: on a
 * fine-textured photo it asks for 70 at the same 85, yet 55 looks just as good.
 */
const EQUIVALENT = [
  [1, 1],
  [50, 35],
  [60, 40],
  [70, 45],
  [80, 50],
  [85, 55],
  [90, 70],
  [95, 80],
  [100, 100],
] as const;

/**
 * AVIF quality for a requested `-q`, so one number means one look across formats.
 * Between two measured points it interpolates in a straight line.
 */
export const avifQualityFor = (quality: number): number => {
  const upper = EQUIVALENT.findIndex(([webp]) => webp >= quality);
  const [toWebp, toAvif] = EQUIVALENT[upper] ?? [100, 100];
  const [fromWebp, fromAvif] = EQUIVALENT[upper - 1] ?? [toWebp, toAvif];
  if (toWebp === fromWebp) return toAvif;
  return Math.round(fromAvif + ((quality - fromWebp) / (toWebp - fromWebp)) * (toAvif - fromAvif));
};
