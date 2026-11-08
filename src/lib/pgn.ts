/** Built by hand because a shot is not a move the PGN standard can express. */
export function buildPgn(headers: Record<string, string>, sans: string[]): string {
  const tags = Object.entries(headers).map(([key, value]) => `[${key} "${value}"]`);
  const moves = sans.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san));
  return `${tags.join('\n')}\n\n${[...moves, headers.Result].join(' ')}\n`;
}
