/**
 * Card encoding: a single integer 0..51 = (rank - 3) * 4 + suit.
 * Higher number = stronger card, so cards compare with plain `<` / `>`.
 * rank: 3..15 (11 = J, 12 = Q, 13 = K, 14 = A, 15 = 2 / "heo")
 * suit: 0 = ♠ bích, 1 = ♣ chuồn/tép, 2 = ♦ rô, 3 = ♥ cơ
 */
export type Card = number;

export const SUITS = ['♠', '♣', '♦', '♥'] as const;
export const SUIT_NAMES = ['Bích', 'Chuồn', 'Rô', 'Cơ'] as const;
export const RANK_LABELS: Record<number, string> = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2',
};

export const RANK_TWO = 15;
export const RANK_ACE = 14;
export const THREE_OF_SPADES: Card = 0;

export const rankOf = (c: Card): number => (c >> 2) + 3;
export const suitOf = (c: Card): number => c & 3;
export const makeCard = (rank: number, suit: number): Card => (rank - 3) * 4 + suit;
export const isRed = (c: Card): boolean => suitOf(c) >= 2;
export const isTwo = (c: Card): boolean => rankOf(c) === RANK_TWO;

export const cardLabel = (c: Card): string => `${RANK_LABELS[rankOf(c)]}${SUITS[suitOf(c)]}`;

export const fullDeck = (): Card[] => Array.from({ length: 52 }, (_, i) => i);

export const sortCards = (cards: readonly Card[]): Card[] => [...cards].sort((a, b) => a - b);

/** Remove `remove` from `hand`; returns null if some card is not in hand. */
export function removeCards(hand: readonly Card[], remove: readonly Card[]): Card[] | null {
  const set = new Set(hand);
  for (const c of remove) {
    if (!set.has(c)) return null;
    set.delete(c);
  }
  if (new Set(remove).size !== remove.length) return null;
  return sortCards([...set]);
}

/** Count of cards per rank, index 0 = rank 3 ... 12 = rank 2. */
export function rankCounts(cards: readonly Card[]): number[] {
  const counts = new Array(13).fill(0);
  for (const c of cards) counts[c >> 2]++;
  return counts;
}
