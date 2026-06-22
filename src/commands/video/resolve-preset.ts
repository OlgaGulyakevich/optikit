import { VIDEO_PRESETS, type PresetName } from './video.presets.js';

/** Validated video flags fed into the resolver. */
export interface VideoFlags {
  preset?: PresetName;
  crf?: number;
  maxWidth?: number;
  mute: boolean;
}

/** Per-command fallbacks applied when a flag/preset doesn't specify a value. */
export interface VideoDefaults {
  /** CRF used when neither `--crf` nor a preset provides one. */
  crf: number;
  /** Width cap used when neither `--max-width` nor a preset provides one. */
  maxWidth?: number;
}

/** Final settings an ffmpeg job is built from (output is always mp4). */
export interface ResolvedVideo {
  crf: number;
  maxWidth?: number;
  mute: boolean;
}

/**
 * Merge preset + explicit flags + per-command defaults into the final settings.
 * Precedence: explicit flag → preset → default.
 */
export const resolveVideoConfig = (flags: VideoFlags, defaults: VideoDefaults): ResolvedVideo => {
  const presetWidth = flags.preset ? VIDEO_PRESETS[flags.preset].maxWidth : undefined;
  return {
    crf: flags.crf ?? defaults.crf,
    maxWidth: flags.maxWidth ?? presetWidth ?? defaults.maxWidth,
    mute: flags.mute,
  };
};
