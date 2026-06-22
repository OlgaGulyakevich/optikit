/** Decimal byte multiplier for a size unit (kb = 1000 b). Bytes for unknown/empty. */
const unitMultiplier = (unit: string): number => {
  switch (unit) {
    case 'kb':
      return 1_000;
    case 'mb':
      return 1_000_000;
    case 'gb':
      return 1_000_000_000;
    default:
      return 1; // bytes
  }
};

/**
 * Parse a human-readable size into bytes: `"200mb"`, `"1.5gb"`, `"500kb"`, or a
 * plain byte count `"1024"`. Case-insensitive, optional space before the unit.
 * Units are decimal (kb = 1000 b). Throws on unrecognized input.
 *
 * @throws Error when the input is not a recognized size.
 * @example parseSize('200mb') // 200_000_000
 */
export const parseSize = (input: string): number => {
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid size: "${input}" — expected e.g. "200mb", "1.5gb", "500kb".`);
  }

  const value = Number(match[1]);
  const unit = (match[2] ?? 'b').toLowerCase();
  return Math.round(value * unitMultiplier(unit));
};
