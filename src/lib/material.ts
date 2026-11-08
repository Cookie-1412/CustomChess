type Color = 'white' | 'black';

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const ORDER = ['q', 'r', 'b', 'n', 'p'];

/** Pieces each colour has captured since `startFen`, plus the material lead. */
export function materialFromFen(fen: string, startFen: string) {
  const counter = (position: string) => (ch: string) => position.split(' ')[0].split(ch).length - 1;
  const count = counter(fen);
  const startCount = counter(startFen);
  const captured: Record<Color, string[]> = { white: [], black: [] };
  let lead = 0;
  for (const type of ORDER) {
    const white = count(type.toUpperCase());
    const black = count(type);
    lead += (white - black) * VALUES[type];
    for (let i = 0; i < startCount(type) - black; i++) captured.white.push(type);
    for (let i = 0; i < startCount(type.toUpperCase()) - white; i++) captured.black.push(type);
  }
  return { captured, lead };
}
