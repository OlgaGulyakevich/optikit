# Architecture — optikit

A CLI utility for optimizing web assets (images, video, OG images, favicons, SVG)
for front-end workflows. Built in TypeScript (`strict`), ESM-only, distributed as
an npm package with an `optikit` bin command.

## Overview

The codebase is organized **by layer**, each with a single responsibility:

```text
cli → commands → tools → core / utils
```

- **cli** — the entry point: parses arguments and registers commands.
- **commands** — one task per command (`img`, `og`, `video`, `svg`, `favicon`),
  including presets and input validation.
- **tools** — the engines that actually do the work (sharp, ffmpeg, svgo, png-to-ico),
  hidden behind a single interface.
- **core / utils** — shared contracts, services, and pure helper functions.

Extensibility is the design goal: **adding a new engine means adding one new
strategy in `src/tools/`** — the core never changes.

## Folder structure

```text
optikit/
├── src/
│   ├── cli.ts                      # bin entry: shebang + commander, command registration
│   ├── commands/                   # ── Command layer (task + presets)
│   │   ├── img/
│   │   │   ├── img.command.ts      #   flags → validate → build jobs → tool.run → report
│   │   │   └── img.schema.ts       #   Zod schema for config + inferred type
│   │   ├── og/
│   │   ├── video/
│   │   │   ├── convert.command.ts
│   │   │   ├── compress.command.ts
│   │   │   └── video.presets.ts    #   mobile / desktop
│   │   ├── favicon/
│   │   └── svg/
│   ├── tools/                      # ── Strategy layer (engines)
│   │   ├── sharp.tool.ts           #   implements Tool<SharpJob>
│   │   ├── ffmpeg.tool.ts          #   implements Tool<FfmpegJob> (spawn + ffprobe inside)
│   │   ├── svgo.tool.ts
│   │   └── ico.tool.ts             #   png-to-ico
│   ├── core/                       # ── framework
│   │   ├── tool.ts                 #   contracts: Tool<Job>, ToolResult, Engine
│   │   ├── tool.factory.ts         #   Factory: engine → Tool
│   │   ├── command.ts              #   CliCommand contract
│   │   ├── file.service.ts         #   path handling / cleanup
│   │   └── logger.ts               #   output + progress
│   └── utils/                      # ── pure functions = unit-test target
│       ├── calc-bitrate.ts         #   size + duration → bitrate
│       ├── naming.ts               #   @1x / @2x / -og suffixes, output names
│       ├── parse-size.ts           #   "200mb" → bytes
│       ├── resolve-preset.ts       #   preset + flags → config
│       └── *.test.ts               #   tests co-located (Vitest)
├── package.json
├── tsconfig.json
└── README.md
```

## Design patterns

| Pattern | Where | How |
| --- | --- | --- |
| **Strategy** | `src/tools/*` | `Tool<Job>` — sharp / ffmpeg / svgo / ico are interchangeable engines. A new tool is a new file. |
| **Factory** | `core/tool.factory.ts` | Maps `engine → Tool` via a registry. |
| **Command** | `src/commands/*` | `CliCommand` + presets = a task with its settings. |
| **Generics** | `Tool<Job>`, `z.infer<typeof schema>` | Type-safe config per tool, derived from the validation schema. |

## Key contracts

Contracts are the skeleton of the app: commands and tools are built on top of
ready-made types, not the other way around.

```ts
// core/tool.ts — Strategy contract
export type Engine = 'sharp' | 'ffmpeg' | 'svgo' | 'ico';

export interface ToolResult {
  outputs: string[]; // paths of generated files
}

/** Strategy: an engine runs one job. How it runs (spawn / function call) is a tool-internal detail. */
export interface Tool<Job> {
  run(job: Job): Promise<ToolResult>;
}
```

```ts
// core/command.ts — Command layer (commander.Command ≠ our CliCommand)
import type { Command as Program } from 'commander';

export interface CliCommand {
  readonly name: string; // "img", "compress"
  register(program: Program): void; // attach flags / description
  run(raw: unknown): Promise<void>; // validate (Zod) → jobs → tool.run → report
}
```

```ts
// commands/img/img.schema.ts — config via Zod (type inferred with z.infer)
export const imgSchema = z.object({
  input: z.string(),
  avif: z.boolean().default(false),
  quality: z.number().min(1).max(100).default(85),
});
export type ImgConfig = z.infer<typeof imgSchema>;
```

## Data flow

```text
argv → commander → CliCommand.run(raw)
  → Zod validate ─────────────→ Config (typed)
  → utils (resolve-preset / naming / calc-bitrate) → Job[]
  → factory.create(engine) ───→ Tool (Strategy)
  → Tool.run(job)  (Promise.all for a batch) → ToolResult
  → logger (progress + summary + <link> snippet for favicon)
```

## spawn vs in-process

`ffmpeg` is an external binary, driven via `spawn` and communication over
stdout/stderr. `sharp`, `svgo`, and `png-to-ico` are npm libraries called as
functions returning a `Promise`. The single `Tool<Job>.run()` interface **hides
this difference inside each strategy**: `FfmpegTool` wraps `spawn` + `ffprobe`
in a Promise, while `SharpTool` simply `await`s `sharp(...)`. The caller never
needs to know how an engine runs — that is the point of the Strategy pattern.

## Testing strategy

Tests target the **pure logic** in `src/utils/` (no IO) — bitrate calculation,
output naming, size parsing, preset resolution — plus the factory (correct `Tool`
per engine). The engines themselves (sharp, ffmpeg, svgo) are not tested directly:
that responsibility belongs to the upstream libraries.
