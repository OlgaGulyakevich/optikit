/**
 * Central console output for the CLI (Singleton as a module-level object).
 *
 * Routing every message through one place keeps formatting consistent and lets
 * us change output behaviour later (quiet mode, `--json`, colors) without
 * touching scattered `console.*` calls. Errors and warnings go to stderr so
 * that piping stdout (e.g. `optikit ... > files.txt`) stays clean.
 */
export const logger = {
  /** Neutral information line (stdout). */
  info(message: string): void {
    console.log(message);
  },

  /** Successful result (stdout). */
  success(message: string): void {
    console.log(`✓ ${message}`);
  },

  /** Non-fatal warning (stderr). */
  warn(message: string): void {
    console.warn(`⚠ ${message}`);
  },

  /** Failure (stderr). */
  error(message: string): void {
    console.error(`✖ ${message}`);
  },
};
