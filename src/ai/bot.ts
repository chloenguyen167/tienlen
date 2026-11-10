import { Card, RANK_TWO, THREE_OF_SPADES, rankOf, removeCards } from '../core/cards';
import { Combo, isBomb } from '../core/combos';
import { GameAction, GameView, checkPlay, isOut, teamOf } from '../core/game';
import { BotLevel } from '../core/settings';
import { analyzeHand, enumeratePlays, isControlGroup, realizeGroup, Group } from './handAnalyzer';

interface Candidate {
  cards: Card[];
  combo: Combo;
  chop: boolean;
  after: number; // analysis cost of remaining hand
  remaining: number; // cards left after playing
  control: boolean; // spends 2s or bombs
}

const isTeammate = (v: GameView, seat: number) => v.mode === 'team' && seat !== v.mySeat && teamOf(seat) === teamOf(v.mySeat);

function opponents(v: GameView): number[] {
  return [0, 1, 2, 3].filter((s) => s !== v.mySeat && !isOut(v, s) && !isTeammate(v, s));
}

/** Fewest cards held by any active opponent. */
function danger(v: GameView): number {
  const opp = opponents(v);
  return opp.length ? Math.min(...opp.map((s) => v.handCounts[s])) : 13;
}

/** Next active seat after me (who will respond to my play). */
function nextActive(v: GameView): number {
  for (let i = 1; i < 4; i++) {
    const s = (v.mySeat + i) % 4;
    if (!isOut(v, s)) return s;
  }
  return v.mySeat;
}

function unseenCards(v: GameView): Card[] {
  const known = new Set([...v.playedCards, ...v.myHand]);
  const out: Card[] = [];
  for (let c = 0; c < 52; c++) if (!known.has(c)) out.push(c);
  return out;
}

/** Nothing unseen is higher than the group's top card → it will almost surely win the trick. */
function isBoss(cards: Card[], unseen: Card[]): boolean {
  const top = Math.max(...cards);
  return unseen.every((c) => c < top);
}

function candidates(v: GameView): Candidate[] {
  const hand = v.myHand;
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const cards of enumeratePlays(hand)) {
    const key = [...cards].sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const chk = checkPlay(v, v.mySeat, cards, hand);
    if (!chk.ok || chk.interrupt) continue;
    const rest = removeCards(hand, cards)!;
    out.push({
      cards: chk.combo.cards,
      combo: chk.combo,
      chop: chk.chop,
      after: analyzeHand(rest).cost,
      remaining: rest.length,
      control: rankOf(chk.combo.top) === RANK_TWO || isBomb(chk.combo),
    });
  }
  return out;
}

const play = (v: GameView, cards: Card[]): GameAction => ({ type: 'play', seat: v.mySeat, cards });
const pass = (v: GameView): GameAction => ({ type: 'pass', seat: v.mySeat });

// ---------------------------------------------------------------------------

function leadMove(v: GameView, level: BotLevel, rand: () => number): Card[] {
  const hand = v.myHand;
  const an = analyzeHand(hand);
  const unseen = unseenCards(v);
  const realized = an.groups.map((g) => ({ g, cards: realizeGroup(g, hand) }));
  const valid = realized.filter((x) => checkPlay(v, v.mySeat, x.cards, hand).ok);

  if (v.mustPlay3S) {
    const withThree = valid.find((x) => x.cards.includes(THREE_OF_SPADES));
    return withThree ? withThree.cards : [THREE_OF_SPADES];
  }
  if (valid.length === 0) return [hand[0]];
  if (an.groups.length === 1 && valid.length === 1) return valid[0].cards;

  const byLow = (a: { g: Group; cards: Card[] }, b: { g: Group; cards: Card[] }) =>
    Math.max(...a.cards) - Math.max(...b.cards) || b.cards.length - a.cards.length;
  const normal = valid.filter((x) => !isControlGroup(x.g)).sort(byLow);
  const control = valid.filter((x) => isControlGroup(x.g)).sort(byLow);

  if (level === 'easy') {
    if (rand() < 0.5) return [hand[0]];
    return (normal[0] ?? control[0]).cards;
  }

  // Feed a teammate who is about to finish.
  const mate = [0, 1, 2, 3].find((s) => isTeammate(v, s) && !isOut(v, s));
  if (mate !== undefined && v.handCounts[mate] === 1) return [hand[0]];

  // Endgame: two groups left → play the winner first, then dump the rest.
  if (an.groups.length === 2) {
    const strong = valid.find((x) => isControlGroup(x.g) || isBoss(x.cards, unseen));
    if (strong) return strong.cards;
  }

  const d = danger(v);
  if (d === 1) {
    // Opponent has one card: avoid leading a small single.
    const multi = [...normal, ...control].find((x) => x.cards.length > 1);
    if (multi) return multi.cards;
    return [hand[hand.length - 1]];
  }
  return (normal[0] ?? control[0]).cards;
}

function followMove(v: GameView, level: BotLevel, rand: () => number): Card[] | null {
  const cands = candidates(v);
  if (cands.length === 0) return null;
  const last = v.lastPlay!;

  const finishing = cands.find((c) => c.remaining === 0);
  if (finishing) return finishing.cards;

  if (level === 'easy') {
    const sorted = [...cands].sort((a, b) => a.combo.top - b.combo.top);
    const pick = sorted.find((c) => !c.control) ?? sorted[0];
    if (rand() < 0.2) return null;
    if (pick.control && v.myHand.length > 6 && rand() < 0.5) return null;
    return pick.cards;
  }

  // Don't fight a teammate.
  if (isTeammate(v, last.seat)) return null;

  const before = analyzeHand(v.myHand).cost;
  const d = danger(v);

  // Hard: next opponent is on one card and this is a singles trick → play the highest single.
  if (level === 'hard' && last.combo.type === 'single') {
    const nxt = nextActive(v);
    if (!isTeammate(v, nxt) && v.handCounts[nxt] === 1) {
      const singles = cands.filter((c) => c.combo.type === 'single').sort((a, b) => b.combo.top - a.combo.top);
      if (singles.length) return singles[0].cards;
    }
  }

  const score = (c: Candidate) => c.after + (c.control ? 0.6 : 0) + c.combo.top * 0.002;
  const sorted = [...cands].sort((a, b) => score(a) - score(b));
  const best = sorted[0];

  if (best.chop) return best.cards; // chặt heo / chặt hàng: always worth it
  if (best.control) {
    const lastIsTwo = rankOf(last.combo.top) === RANK_TWO;
    const urgent = d <= 3 || v.myHand.length <= 6;
    // Hard: beat a 2 with a bigger 2 only when it is (almost) unbeatable, to win back the lead.
    const boss = level === 'hard' && lastIsTwo && best.combo.type === 'single' && isBoss(best.cards, unseenCards(v));
    if (urgent || boss) return best.cards;
    return null;
  }
  const delta = best.after - before;
  if (delta <= -0.2) return best.cards;
  if (d <= 3) return best.cards;
  if (delta <= 0.3 && v.myHand.length >= 10) return best.cards;
  return null;
}

/** Decide what a bot does on its turn. */
export function chooseBotAction(v: GameView, level: BotLevel, rand: () => number = Math.random): GameAction {
  if (!v.lastPlay) return play(v, leadMove(v, level, rand));
  const cards = followMove(v, level, rand);
  return cards ? play(v, cards) : pass(v);
}

/** 4 đôi thông out-of-turn chop opportunity for a bot (or null). */
export function botInterrupt(v: GameView, level: BotLevel, rand: () => number = Math.random): GameAction | null {
  if (v.phase !== 'playing' || !v.lastPlay || v.turn === v.mySeat || isOut(v, v.mySeat)) return null;
  if (!v.rules.fourPairsAnytime || !v.rules.allowChop) return null;
  if (isTeammate(v, v.lastPlay.seat) || v.lastPlay.seat === v.mySeat) return null;
  if (level === 'easy' && rand() < 0.5) return null;
  for (const cards of enumeratePlays(v.myHand)) {
    if (cards.length < 8) continue;
    const chk = checkPlay(v, v.mySeat, cards, v.myHand);
    if (chk.ok && chk.interrupt) return play(v, chk.combo.cards);
  }
  return null;
}

/** What to do when a human's turn timer runs out. */
export function timeoutAction(v: GameView): GameAction {
  if (v.lastPlay) return pass(v);
  return play(v, v.mustPlay3S ? [THREE_OF_SPADES] : [v.myHand[0]]);
}

/** Hint list for the "Gợi ý" button: bot's pick first, then every other legal play (low → high). */
export function hintPlays(v: GameView): Card[][] {
  if (v.phase !== 'playing' || v.turn !== v.mySeat) return [];
  const out: Card[][] = [];
  const seen = new Set<string>();
  const add = (cards: Card[]) => {
    const key = [...cards].sort((a, b) => a - b).join(',');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(cards);
    }
  };
  const act = chooseBotAction(v, 'medium');
  if (act.type === 'play') add(act.cards);
  const rest = candidates(v).sort((a, b) => a.combo.top - b.combo.top || a.cards.length - b.cards.length);
  for (const c of rest) add(c.cards);
  return out;
}

/** Can this player chop out of turn right now with 4 đôi thông? Returns the cards. */
export function interruptOption(v: GameView): Card[] | null {
  if (v.phase !== 'playing' || !v.lastPlay || v.turn === v.mySeat || v.lastPlay.seat === v.mySeat || isOut(v, v.mySeat)) return null;
  if (!v.rules.fourPairsAnytime || !v.rules.allowChop) return null;
  for (const cards of enumeratePlays(v.myHand)) {
    if (cards.length < 8) continue;
    const chk = checkPlay(v, v.mySeat, cards, v.myHand);
    if (chk.ok && chk.interrupt) return chk.combo.cards;
  }
  return null;
}
