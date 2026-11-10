import { Card, rankCounts, suitOf } from '../core/cards';
import { ComboType } from '../core/combos';

/** A rank-level group: `per` cards at each rank index in `ranks` (rank index 0 = 3 ... 12 = 2). */
export interface Group {
  type: ComboType;
  ranks: number[];
  per: number;
}

export interface Analysis {
  cost: number;
  groups: Group[];
}

const TWO = 12;

export const isControlGroup = (g: Group): boolean =>
  g.ranks.includes(TWO) || g.type === 'quad' || (g.type === 'pairSeq' && g.ranks.length >= 3);

/** Rough "how many tricks do I need to spend on this group" cost. Control cards are cheap. */
function groupCost(g: Group): number {
  if (isControlGroup(g)) return 0.3;
  const top = g.ranks[g.ranks.length - 1];
  let cost = 1 - top * 0.025; // higher groups win tricks more often
  if (g.type === 'single' && top < 8) cost += 0.15; // low singles are the worst
  return cost;
}

const memo = new Map<string, Analysis>();

/** Best decomposition of a hand (as rank counts) into playable groups. */
export function analyzeCounts(counts: number[]): Analysis {
  const key = counts.join('');
  const hit = memo.get(key);
  if (hit) return hit;

  const i = counts.findIndex((c) => c > 0);
  if (i < 0) return { cost: 0, groups: [] };

  let best: Analysis = { cost: Infinity, groups: [] };
  const consider = (g: Group) => {
    const rest = [...counts];
    for (const r of g.ranks) rest[r] -= g.per;
    const sub = analyzeCounts(rest);
    const cost = sub.cost + groupCost(g);
    if (cost < best.cost - 1e-9) best = { cost, groups: [g, ...sub.groups] };
  };

  const setTypes: ComboType[] = ['single', 'single', 'pair', 'triple', 'quad'];
  for (let k = counts[i]; k >= 1; k--) consider({ type: setTypes[k], ranks: [i], per: k });

  if (i < TWO) {
    const run: number[] = [i];
    for (let j = i + 1; j < TWO && counts[j] >= 1; j++) {
      run.push(j);
      if (run.length >= 3) consider({ type: 'straight', ranks: [...run], per: 1 });
    }
    if (counts[i] >= 2) {
      const pr: number[] = [i];
      for (let j = i + 1; j < TWO && counts[j] >= 2; j++) {
        pr.push(j);
        if (pr.length >= 3) consider({ type: 'pairSeq', ranks: [...pr], per: 2 });
      }
    }
  }

  if (memo.size > 50000) memo.clear();
  memo.set(key, best);
  return best;
}

export const analyzeHand = (hand: readonly Card[]): Analysis => analyzeCounts(rankCounts(hand));

/** Pick concrete cards for a group, using the lowest suits (keeps strong suits for later). */
export function realizeGroup(g: Group, hand: readonly Card[]): Card[] {
  const out: Card[] = [];
  for (const r of g.ranks) {
    const ofRank = hand.filter((c) => c >> 2 === r).sort((a, b) => suitOf(a) - suitOf(b));
    out.push(...ofRank.slice(0, g.per));
  }
  return out;
}

const combos = <T,>(arr: T[], k: number): T[][] => {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [h, ...t] = arr;
  return [...combos(t, k - 1).map((x) => [h, ...x]), ...combos(t, k)];
};

/** Enumerate (canonical) playable card sets from a hand. */
export function enumeratePlays(hand: readonly Card[]): Card[][] {
  const byRank: Card[][] = Array.from({ length: 13 }, () => []);
  for (const c of [...hand].sort((a, b) => a - b)) byRank[c >> 2].push(c);
  const out: Card[][] = [];

  for (let r = 0; r < 13; r++) {
    const cs = byRank[r];
    for (let k = 1; k <= Math.min(4, cs.length); k++) out.push(...combos(cs, k));
  }

  for (let s = 0; s < TWO; s++) {
    // straights
    for (let e = s; e < TWO && byRank[e].length >= 1; e++) {
      if (e - s + 1 < 3) continue;
      const base: Card[] = [];
      for (let r = s; r < e; r++) base.push(byRank[r][0]);
      for (const topCard of byRank[e]) out.push([...base, topCard]);
    }
    // consecutive pairs
    for (let e = s; e < TWO && byRank[e].length >= 2; e++) {
      if (e - s + 1 < 3) continue;
      const base: Card[] = [];
      for (let r = s; r < e; r++) base.push(byRank[r][0], byRank[r][1]);
      for (const pair of combos(byRank[e], 2)) out.push([...base, ...pair]);
    }
  }
  return out;
}
