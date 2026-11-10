import { Card, RANK_TWO, rankOf, sortCards } from './cards';

export type ComboType = 'single' | 'pair' | 'triple' | 'straight' | 'pairSeq' | 'quad';

export interface Combo {
  type: ComboType;
  cards: Card[]; // sorted ascending
  top: Card; // highest card, decides who wins between same-shape combos
  /** straight: number of cards; pairSeq: number of pairs; others: number of cards */
  size: number;
}

export const COMBO_NAMES: Record<ComboType, string> = {
  single: 'Rác',
  pair: 'Đôi',
  triple: 'Sám cô',
  straight: 'Sảnh',
  pairSeq: 'Đôi thông',
  quad: 'Tứ quý',
};

export function comboName(c: Combo): string {
  if (c.type === 'straight') return `Sảnh ${c.size} lá`;
  if (c.type === 'pairSeq') return `${c.size} đôi thông`;
  if (c.type === 'single' && rankOf(c.top) === RANK_TWO) return 'Heo';
  if (c.type === 'pair' && rankOf(c.top) === RANK_TWO) return 'Đôi heo';
  return COMBO_NAMES[c.type];
}

/** Detect which combo (if any) a set of cards forms. */
export function detectCombo(input: readonly Card[]): Combo | null {
  const n = input.length;
  if (n === 0 || new Set(input).size !== n) return null;
  const cards = sortCards(input);
  const top = cards[n - 1];
  const ranks = cards.map(rankOf);
  const allSame = ranks.every((r) => r === ranks[0]);

  if (allSame) {
    if (n === 1) return { type: 'single', cards, top, size: 1 };
    if (n === 2) return { type: 'pair', cards, top, size: 2 };
    if (n === 3) return { type: 'triple', cards, top, size: 3 };
    if (n === 4) return { type: 'quad', cards, top, size: 4 };
    return null;
  }

  if (ranks[n - 1] === RANK_TWO) return null; // 2 never part of a sequence

  // straight: >= 3 distinct consecutive ranks
  if (n >= 3) {
    let ok = true;
    for (let i = 1; i < n; i++) if (ranks[i] !== ranks[i - 1] + 1) { ok = false; break; }
    if (ok) return { type: 'straight', cards, top, size: n };
  }

  // consecutive pairs: >= 3 pairs
  if (n >= 6 && n % 2 === 0) {
    let ok = true;
    for (let i = 0; i < n; i += 2) {
      if (ranks[i] !== ranks[i + 1]) { ok = false; break; }
      if (i > 0 && ranks[i] !== ranks[i - 2] + 1) { ok = false; break; }
    }
    if (ok) return { type: 'pairSeq', cards, top, size: n / 2 };
  }
  return null;
}

/** "Hàng" = bombs that can chop 2s. */
export const isBomb = (c: Combo): boolean => c.type === 'quad' || (c.type === 'pairSeq' && c.size >= 3);
export const containsTwo = (c: Combo): boolean => rankOf(c.top) === RANK_TWO;
