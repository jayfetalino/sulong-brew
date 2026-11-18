/** "DF DF 03" or "dfdf03" to bytes. Throws on anything that is not hexadecimal pairs. */
export function fromHex(text: string): Uint8Array {
  const compact = text.replace(/\s+/g, '');
  if (compact.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(compact)) {
    throw new RangeError(`Not valid hexadecimal bytes: "${text}"`);
  }
  const bytes = new Uint8Array(compact.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(compact.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Bytes to spaced, upper-case hexadecimal, the way DiFluid's documents write them. */
export function toHex(bytes: ArrayLike<number>): string {
  return Array.from({ length: bytes.length }, (_, i) =>
    (bytes[i] as number).toString(16).toUpperCase().padStart(2, '0'),
  ).join(' ');
}
