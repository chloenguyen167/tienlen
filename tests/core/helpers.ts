import { Card, makeCard } from '../../src/core/cards';

const RANKS: Record<string, number> = { '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14, '2': 15 };
const SUITS: Record<string, number> = { s: 0, c: 1, d: 2, h: 3 };

/** Parse "3s 4c 10h As 2h" into cards. */
export function cs(str: string): Card[] {
  return str.trim().split(/\s+/).map((t) => {
    const suit = SUITS[t.slice(-1)];
    const rank = RANKS[t.slice(0, -1)];
    if (suit === undefined || rank === undefined) throw new Error(`bad card ${t}`);
    return makeCard(rank, suit);
  });
}
export const c = (s: string): Card => cs(s)[0];
