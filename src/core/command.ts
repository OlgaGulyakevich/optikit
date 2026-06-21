import type { Command as Program } from 'commander';

/**
 * Command contract: one CLI subcommand (`img`, `og`, `compress`, ...) as a
 * self-contained unit. A single contract lets `cli.ts` register every command
 * uniformly instead of wiring each one by hand.
 *
 * Note: `Program` is commander's own command/parser object — distinct from this
 * `CliCommand` abstraction, hence the import alias.
 */
export interface CliCommand {
  /** Subcommand name as typed in the terminal, e.g. "img". */
  readonly name: string;

  /** Attach this command's description and flags to the commander program. */
  register(program: Program): void;

  /**
   * Execute the command. `raw` is the unvalidated input from argv (hence
   * `unknown`): validate it with Zod, build jobs, run the tool, report results.
   */
  run(raw: unknown): Promise<void>;
}
