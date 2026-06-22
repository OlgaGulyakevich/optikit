/**
 * Named video presets. A preset is a bundle of settings (currently a resolution
 * ceiling); explicit flags can still override individual values. `mobile` /
 * `desktop` cap the output width — never upscaling.
 */
export const VIDEO_PRESETS = {
  mobile: { maxWidth: 1280 }, // 720p
  desktop: { maxWidth: 1920 }, // 1080p
} as const;

/** Valid `--preset` values, derived from the presets object. */
export type PresetName = keyof typeof VIDEO_PRESETS;
