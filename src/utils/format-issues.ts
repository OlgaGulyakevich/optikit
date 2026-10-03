/** The part of a Zod issue we print — kept structural so this stays a pure, Zod-free helper. */
export interface Issue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/** Schema key → what the user typed: `sameAs` → `--same-as`, `input` → `<input>`. */
const toFlag = (key: PropertyKey): string => {
  const name = String(key);
  if (name === 'input') return '<input>';
  return `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
};

/**
 * Turn validation issues into one readable line each, named by the CLI flag.
 * Replaces the raw JSON dump a `ZodError` prints as its message.
 *
 * @example
 * formatIssues([{ path: ['quality'], message: 'Too big: expected number to be <=100' }])
 * // → ['--quality: Too big: expected number to be <=100']
 */
export const formatIssues = (issues: readonly Issue[]): string[] =>
  issues.map(({ path, message }) => {
    const [key] = path;
    return key === undefined ? message : `${toFlag(key)}: ${message}`;
  });
