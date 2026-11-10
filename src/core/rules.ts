import { Card, RANK_TWO, rankCounts, rankOf, isRed } from './cards';
import { Combo } from './combos';
import { RuleSettings } from './settings';

export type BeatResult = false | 'normal' | 'chop';

/**
 * Can `next` be played on top of `prev`?
 * `prevWasChop` = the previous play itself was a chop (needed for the chopStack rule).
 */
export function canBeat(prev: Combo | null, next: Combo, rules: RuleSettings, prevWasChop = false): BeatResult {
  if (!prev) return 'normal';
  if (prev.type === next.type && prev.size === next.size && prev.cards.length === next.cards.length) {
    return next.top > prev.top ? 'normal' : false;
  }
  if (!rules.allowChop) return false;
  if (prevWasChop && !rules.chopStack) return false;

  const prevSingle2 = prev.type === 'single' && rankOf(prev.top) === RANK_TWO;
  const prevPair2 = prev.type === 'pair' && rankOf(prev.top) === RANK_TWO;
  const prev3Pairs = prev.type === 'pairSeq' && prev.size === 3;
  const prevQuad = prev.type === 'quad';

  if (next.type === 'pairSeq' && next.size === 3) {
    return prevSingle2 ? 'chop' : false;
  }
  if (next.type === 'quad') {
    return prevSingle2 || prevPair2 || prev3Pairs ? 'chop' : false;
  }
  if (next.type === 'pairSeq' && next.size >= 4) {
    // 4+ đôi thông chặt heo, đôi heo, 3 đôi thông, tứ quý, và đôi thông ngắn hơn
    if (prevSingle2 || prevPair2 || prev3Pairs || prevQuad) return 'chop';
    if (prev.type === 'pairSeq' && prev.size < next.size) return 'chop';
    return false;
  }
  return false;
}

/** Point value of a combo when it gets chopped (or "thối" at the end). */
export function chopValue(c: Combo): number {
  if (c.type === 'single' && rankOf(c.top) === RANK_TWO) return isRed(c.top) ? 4 : 2;
  if (c.type === 'pair' && rankOf(c.top) === RANK_TWO) return c.cards.reduce((s, x) => s + (isRed(x) ? 4 : 2), 0);
  if (c.type === 'pairSeq' && c.size === 3) return 5;
  if (c.type === 'quad') return 6;
  if (c.type === 'pairSeq' && c.size >= 4) return 8;
  return 0;
}

export type InstantWinKind = 'fourTwos' | 'dragon' | 'fivePairSeq' | 'sixPairs';
export const INSTANT_WIN_NAMES: Record<InstantWinKind, string> = {
  fourTwos: 'Tứ quý heo',
  dragon: 'Sảnh rồng (3 → A)',
  fivePairSeq: '5 đôi thông',
  sixPairs: '6 đôi',
};

/** Check a freshly dealt 13-card hand for "tới trắng". */
export function detectInstantWin(hand: readonly Card[]): InstantWinKind | null {
  const counts = rankCounts(hand);
  if (counts[12] === 4) return 'fourTwos';
  if (counts.slice(0, 12).every((c) => c >= 1)) return 'dragon';
  let run = 0;
  for (let i = 0; i < 12; i++) {
    run = counts[i] >= 2 ? run + 1 : 0;
    if (run >= 5) return 'fivePairSeq';
  }
  const pairs = counts.reduce((s, c) => s + Math.floor(c / 2), 0);
  if (pairs >= 6) return 'sixPairs';
  return null;
}

export interface ThoiItem { label: string; value: number }

/** Cards left in hand that are penalised at the end: 2s and bombs. */
export function thoiItems(hand: readonly Card[]): ThoiItem[] {
  const items: ThoiItem[] = [];
  for (const c of hand) {
    if (rankOf(c) === RANK_TWO) items.push({ label: isRed(c) ? 'Heo đỏ' : 'Heo đen', value: isRed(c) ? 4 : 2 });
  }
  const counts = rankCounts(hand);
  for (let i = 0; i < 12; i++) if (counts[i] === 4) items.push({ label: 'Tứ quý', value: 6 });
  let run = 0;
  for (let i = 0; i <= 12; i++) {
    if (i < 12 && counts[i] >= 2 && counts[i] < 4) run++;
    else {
      if (run >= 4) items.push({ label: `${run} đôi thông`, value: 8 });
      else if (run === 3) items.push({ label: '3 đôi thông', value: 5 });
      run = 0;
    }
  }
  return items;
}
