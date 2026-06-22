/** Inputs for the target-size bitrate calculation. */
export interface BitrateInput {
  /** Desired maximum output size, in bytes. */
  targetBytes: number;
  /** Video duration, in seconds. */
  durationSeconds: number;
  /** Bits per second reserved for the audio track. Defaults to 128 kbps. */
  audioBitrate?: number;
}

/**
 * Video bitrate (bits/s) needed to fit `targetBytes` over `durationSeconds`,
 * reserving `audioBitrate` for sound. Based on `size ≈ bitrate × duration`.
 * Callers may apply a small safety margin to avoid container overhead overshoot.
 *
 * @throws Error if duration/target are not positive, or the target is too small.
 */
export const calcVideoBitrate = ({
  targetBytes,
  durationSeconds,
  audioBitrate = 128_000,
}: BitrateInput): number => {
  if (durationSeconds <= 0) {
    throw new Error('durationSeconds must be > 0.');
  }
  if (targetBytes <= 0) {
    throw new Error('targetBytes must be > 0.');
  }

  const totalBitrate = (targetBytes * 8) / durationSeconds;
  const videoBitrate = Math.floor(totalBitrate - audioBitrate);

  if (videoBitrate <= 0) {
    throw new Error('Target size is too small for this duration and audio bitrate.');
  }
  return videoBitrate;
};
