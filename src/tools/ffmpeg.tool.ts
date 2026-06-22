import { spawn } from 'node:child_process';
import type { Tool, ToolResult } from '../core/tool.js';

/** Web video container/codec the ffmpeg engine targets. */
export type VideoFormat = 'mp4' | 'webm';

/** One ffmpeg operation: transcode `input` → `output` with the given settings. */
export interface FfmpegJob {
  input: string;
  output: string;
  format: VideoFormat;
  /** Constant Rate Factor — quality knob (lower = better quality, larger file). */
  crf: number;
  /** Cap output width to this many px (keeps aspect, never upscales). */
  maxWidth?: number;
  /** Drop the audio track. */
  mute?: boolean;
}

const videoCodec = (format: VideoFormat): string =>
  format === 'webm' ? 'libvpx-vp9' : 'libx264';

const audioCodec = (format: VideoFormat): string =>
  format === 'webm' ? 'libopus' : 'aac';

/** Build ffmpeg CLI args for a single-pass (CRF) transcode. */
const buildArgs = (job: FfmpegJob): string[] => {
  const args = ['-y', '-i', job.input, '-c:v', videoCodec(job.format), '-crf', String(job.crf)];

  if (job.format === 'mp4') {
    args.push('-preset', 'medium', '-pix_fmt', 'yuv420p');
  } else {
    args.push('-b:v', '0'); // vp9 constant-quality mode
  }

  if (job.maxWidth !== undefined) {
    // Cap width, keep aspect (height auto, even); the escaped comma protects min().
    args.push('-vf', `scale=min(iw\\,${job.maxWidth}):-2`);
  }

  if (job.mute) {
    args.push('-an');
  } else {
    args.push('-c:a', audioCodec(job.format));
  }

  args.push(job.output);
  return args;
};

/** Spawn ffmpeg with `args`; resolve on exit code 0, reject otherwise. */
const runFfmpeg = (args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject); // e.g. ffmpeg not installed
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${String(code)}\n${stderr.slice(-500)}`));
      }
    });
  });

/** Probe a media file's duration in seconds (via ffprobe). Feeds bitrate math. */
export const probeDuration = (input: string): Promise<number> =>
  new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      input,
    ]);
    let out = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      const seconds = Number.parseFloat(out.trim());
      if (code === 0 && Number.isFinite(seconds)) {
        resolve(seconds);
      } else {
        reject(new Error(`ffprobe could not read duration for "${input}".`));
      }
    });
  });

/**
 * Strategy implementation for video (ffmpeg). Unlike sharp, the work runs in an
 * external process: `spawn` + communication over stderr, wrapped in a Promise.
 */
export class FfmpegTool implements Tool<FfmpegJob> {
  async run(job: FfmpegJob): Promise<ToolResult> {
    await runFfmpeg(buildArgs(job));
    return { outputs: [job.output] };
  }
}
