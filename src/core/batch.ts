import { logger } from './logger.js';

/**
 * Run `work` for each item in turn. A failure is reported by name and the rest
 * still run, so one broken file does not cost the whole batch. Returns how many
 * failed: the caller finishes up, then hands it to `assertNoFailures` for the exit code.
 */
export const runBatch = async <T>(
  items: readonly T[],
  nameOf: (item: T) => string,
  work: (item: T) => Promise<void>,
): Promise<number> => {
  let failed = 0;
  for (const item of items) {
    try {
      await work(item);
    } catch (error) {
      failed += 1;
      const name = nameOf(item);
      const message = error instanceof Error ? error.message : String(error);
      logger.error(message.includes(name) ? message : `${name}: ${message}`);
    }
  }
  return failed;
};

/** A partial success is not a success: throw, and `cli.ts` turns it into exit 1. */
export const assertNoFailures = (failed: number, total: number): void => {
  if (failed > 0) throw new Error(`${failed} of ${total} file(s) failed, listed above.`);
};
