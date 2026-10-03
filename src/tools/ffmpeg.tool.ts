import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import type { Tool, ToolResult } from '../core/tool.js';

interface FfmpegBase {
  input: string;
  output: string;
  /** Cap output width to this many px (keeps aspect, never upscales). */
  maxWidth?: number;
  /** Drop the audio track. */
  mute?: boolean;
}

/** Quality mode: single-pass CRF (lower = better quality, larger file). */
export interface CrfJob extends FfmpegBase {
  crf: number;
}

/** Target-size mode: two-pass at a fixed video bitrate (bits/s). */
export interface BitrateJob extends FfmpegBase {
  videoBitrate: number;
}

/**
 * Faststart-only mode: copy the streams untouched (no re-encode, no quality
 * loss) and only move the index to the front. Seconds, even for long clips.
 */
export interface RemuxJob {
  input: string;
  output: string;
  copy: true;
}

/** One ffmpeg operation. Encoding jobs output web mp4 / H.264; a remux keeps the codecs. */
export type FfmpegJob = CrfJob | BitrateJob | RemuxJob;

/**
 * Move the `moov` index in front of the media data, so a browser can start
 * playing before the whole file has arrived. ffmpeg's default puts it at the
 * end — and then every first play waits for a second request to the file's tail.
 */
const FASTSTART = ['-movflags', '+faststart'];

const scaleArgs = (job: FfmpegBase): string[] =>
  job.maxWidth === undefined ? [] : ['-vf', `scale=min(iw\\,${job.maxWidth}):-2`];

const audioArgs = (job: FfmpegBase): string[] => (job.mute ? ['-an'] : ['-c:a', 'aac']);

/** CLI args for a single-pass (CRF) H.264 mp4 transcode. */
const buildArgs = (job: CrfJob): string[] => [
  '-y',
  '-i',
  job.input,
  '-c:v',
  'libx264',
  '-crf',
  String(job.crf),
  '-preset',
  'medium',
  '-pix_fmt',
  'yuv420p',
  ...scaleArgs(job),
  ...audioArgs(job),
  ...FASTSTART,
  job.output,
];

/** CLI args for a stream-copy remux: same codecs, index moved to the front. */
const buildRemuxArgs = (job: RemuxJob): string[] => [
  '-y',
  '-i',
  job.input,
  '-c',
  'copy',
  ...FASTSTART,
  job.output,
];

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

/** Two-pass encode at a target video bitrate — accurate size control. */
const runTwoPass = async (job: BitrateJob): Promise<void> => {
  const passlog = `${job.output}.passlog`;
  const shared = [
    '-i',
    job.input,
    '-c:v',
    'libx264',
    '-b:v',
    String(job.videoBitrate),
    '-preset',
    'medium',
    '-pix_fmt',
    'yuv420p',
    ...scaleArgs(job),
    '-passlogfile',
    passlog,
  ];
  try {
    await runFfmpeg(['-y', ...shared, '-pass', '1', '-an', '-f', 'null', '-']);
    // Pass 1 writes nothing (`-f null`), so faststart only belongs to pass 2.
    await runFfmpeg(['-y', ...shared, '-pass', '2', ...audioArgs(job), ...FASTSTART, job.output]);
  } finally {
    await rm(`${passlog}-0.log`, { force: true });
    await rm(`${passlog}-0.log.mbtree`, { force: true });
  }
};

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
 * Strategy implementation for video (ffmpeg → mp4/H.264). Runs in an external
 * process: `spawn` + stderr, wrapped in a Promise. CRF jobs are single-pass;
 * bitrate jobs run two passes for accurate target-size control; remux jobs
 * copy the streams as-is. Every output is faststart.
 */
export class FfmpegTool implements Tool<FfmpegJob> {
  async run(job: FfmpegJob): Promise<ToolResult> {
    if ('copy' in job) {
      await runFfmpeg(buildRemuxArgs(job));
    } else if ('videoBitrate' in job) {
      await runTwoPass(job);
    } else {
      await runFfmpeg(buildArgs(job));
    }
    return { outputs: [job.output] };
  }
}

/**
 * Decode `count` evenly spaced frames from `start` over `span` seconds in ONE
 * pass, each squashed to `size`×`size` greyscale. Raw bytes, so every frame is
 * exactly `size²` long and the stream splits by arithmetic alone.
 *
 * One pass matters: a clip with a single keyframe makes every separate seek
 * decode from the start again. Squashing the aspect ratio is fine for scoring —
 * frames of one clip are only compared with each other.
 */
export const sampleGrayFrames = (
  input: string,
  { start, span, count, size }: { start: number; span: number; count: number; size: number },
): Promise<Uint8Array[]> =>
  new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-v',
      'error',
      '-ss',
      start.toFixed(3),
      '-t',
      span.toFixed(3),
      '-i',
      input,
      '-vf',
      `fps=${count}/${span.toFixed(3)},scale=${size}:${size},format=gray`,
      '-f',
      'rawvideo',
      '-',
    ]);
    const chunks: Buffer[] = [];
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg could not sample frames of "${input}".\n${stderr.slice(-300)}`));
        return;
      }
      const raw = new Uint8Array(Buffer.concat(chunks));
      const frameSize = size * size;
      const frames: Uint8Array[] = [];
      for (let offset = 0; offset + frameSize <= raw.length && frames.length < count; offset += frameSize) {
        frames.push(raw.subarray(offset, offset + frameSize));
      }
      resolve(frames);
    });
  });

/**
 * Grab one frame at `seconds` as PNG bytes (stdout, no temp file). `-ss` before
 * `-i` seeks fast and still lands on the exact frame; rotation metadata (phone
 * video) is applied, so a portrait clip gives a portrait frame.
 */
export const extractFrame = (input: string, seconds: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-v',
      'error',
      '-ss',
      seconds.toFixed(3),
      '-i',
      input,
      '-frames:v',
      '1',
      '-f',
      'image2pipe',
      '-c:v',
      'png',
      '-',
    ]);
    const chunks: Buffer[] = [];
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      const png = Buffer.concat(chunks);
      if (code === 0 && png.length > 0) {
        resolve(png);
      } else {
        reject(new Error(`ffmpeg could not read a frame at ${seconds.toFixed(1)}s of "${input}".\n${stderr.slice(-300)}`));
      }
    });
  });
