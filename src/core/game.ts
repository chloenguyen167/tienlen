import { Card, THREE_OF_SPADES, fullDeck, removeCards, sortCards, cardLabel } from './cards';
import { Combo, comboName, detectCombo, isBomb } from './combos';
import { canBeat, chopValue, detectInstantWin, InstantWinKind, INSTANT_WIN_NAMES, thoiItems, ThoiItem } from './rules';
import { RuleSettings } from './settings';
import { mulberry32, shuffle } from './rng';

export type GameMode = 'solo' | 'team';

export interface PlayerInfo {
  name: string;
  avatar: string;
  isBot: boolean;
}

export interface Play {
  seat: number;
  cards: Card[];
  combo: Combo;
  chop: boolean;
}

export interface Transfer {
  from: number;
  to: number;
  amount: number;
  reason: string;
}

export type GameEventBody =
  | { type: 'deal'; leader: number }
  | { type: 'play'; seat: number; cards: Card[]; label: string; chop: boolean; victim?: number }
  | { type: 'pass'; seat: number }
  | { type: 'newRound'; leader: number }
  | { type: 'finish'; seat: number; place: number }
  | { type: 'cong'; seats: number[] }
  | { type: 'instantWin'; seat: number; kind: InstantWinKind }
  | { type: 'end' };

export type GameEvent = GameEventBody & { id: number };

export interface GameResult {
  /** seats from first to last */
  ranking: number[];
  winnerTeam: 0 | 1 | null;
  instantWin: { seat: number; kind: InstantWinKind; label: string } | null;
  cong: number[];
  thoi: { seat: number; items: ThoiItem[] }[];
  transfers: Transfer[];
  /** points won/lost by each seat this game */
  deltas: number[];
}

export interface GameState {
  v: 1;
  id: string;
  mode: GameMode;
  rules: RuleSettings;
  players: PlayerInfo[];
  hands: Card[][];
  turn: number;
  phase: 'playing' | 'ended';
  lastPlay: Play | null;
  trickPlays: Play[];
  passed: boolean[];
  mustPlay3S: boolean;
  playedAny: boolean[];
  finished: number[];
  cong: number[];
  chopPending: Transfer | null;
  transfers: Transfer[];
  playedCards: Card[];
  moveNo: number;
  turnStartedAt: number;
  events: GameEvent[];
  eventSeq: number;
  result: GameResult | null;
}

export type GameAction =
  | { type: 'play'; seat: number; cards: Card[] }
  | { type: 'pass'; seat: number };

export const teamOf = (seat: number): 0 | 1 => (seat % 2) as 0 | 1;
export const nextSeat = (s: number): number => (s + 1) % 4;

export interface CreateGameOptions {
  id: string;
  mode: GameMode;
  rules: RuleSettings;
  players: PlayerInfo[];
  seed: number;
  /** seat that leads (winner of previous game). null/undefined = first game, 3♠ leads. */
  leader?: number | null;
  now: number;
}

export function createGame(o: CreateGameOptions): GameState {
  const deck = shuffle(fullDeck(), mulberry32(o.seed));
  const hands = [0, 1, 2, 3].map((i) => sortCards(deck.slice(i * 13, i * 13 + 13)));
  const firstGame = o.leader == null;
  const turn = firstGame ? hands.findIndex((h) => h.includes(THREE_OF_SPADES)) : o.leader!;

  let s: GameState = {
    v: 1,
    id: o.id,
    mode: o.mode,
    rules: o.rules,
    players: o.players,
    hands,
    turn,
    phase: 'playing',
    lastPlay: null,
    trickPlays: [],
    passed: [false, false, false, false],
    mustPlay3S: firstGame && o.rules.require3Spades,
    playedAny: [false, false, false, false],
    finished: [],
    cong: [],
    chopPending: null,
    transfers: [],
    playedCards: [],
    moveNo: 0,
    turnStartedAt: o.now,
    events: [],
    eventSeq: 0,
    result: null,
  };
  s = pushEvent(s, { type: 'deal', leader: turn });

  if (o.rules.instantWin) {
    for (let i = 0; i < 4; i++) {
      const seat = (turn + i) % 4;
      const kind = detectInstantWin(hands[seat]);
      if (kind) {
        s = pushEvent(s, { type: 'instantWin', seat, kind });
        return endInstantWin(s, seat, kind);
      }
    }
  }
  return s;
}

function pushEvent(s: GameState, e: GameEventBody): GameState {
  const id = s.eventSeq + 1;
  const events = [...s.events, { ...e, id } as GameEvent].slice(-24);
  return { ...s, events, eventSeq: id };
}

export const isOut = (s: GameState | GameView, seat: number): boolean =>
  s.finished.includes(seat) || s.cong.includes(seat);

export type PlayCheck =
  | { ok: true; combo: Combo; chop: boolean; interrupt: boolean }
  | { ok: false; error: string };

/** Validate a play. Works on both full state and a player's view (only own hand needed). */
export function checkPlay(s: GameState | GameView, seat: number, cards: readonly Card[], hand: readonly Card[]): PlayCheck {
  if (s.phase !== 'playing') return { ok: false, error: 'Ván đã kết thúc' };
  if (isOut(s, seat)) return { ok: false, error: 'Bạn đã hết lượt chơi' };
  if (cards.length === 0) return { ok: false, error: 'Chọn bài để đánh' };
  if (!removeCards(hand, cards)) return { ok: false, error: 'Bài không có trên tay' };
  const combo = detectCombo(cards);
  if (!combo) return { ok: false, error: 'Bộ bài không hợp lệ' };
  const last = s.lastPlay;
  const rules = s.rules;

  if (seat !== s.turn) {
    const canInterrupt =
      rules.fourPairsAnytime &&
      rules.allowChop &&
      combo.type === 'pairSeq' &&
      combo.size >= 4 &&
      last !== null &&
      last.seat !== seat &&
      canBeat(last.combo, combo, rules, last.chop) === 'chop';
    if (canInterrupt) return { ok: true, combo, chop: true, interrupt: true };
    return { ok: false, error: 'Chưa tới lượt bạn' };
  }

  if (s.mustPlay3S && !cards.includes(THREE_OF_SPADES)) {
    return { ok: false, error: 'Ván đầu phải đánh kèm 3♠' };
  }
  const beat = canBeat(last?.combo ?? null, combo, rules, last?.chop ?? false);
  if (!beat) return { ok: false, error: last ? 'Bài không chặn được' : 'Bộ bài không hợp lệ' };
  const chop = beat === 'chop' || (!!last && last.chop && isBomb(combo));
  return { ok: true, combo, chop, interrupt: false };
}

export type ApplyResult = { ok: true; state: GameState } | { ok: false; error: string };

export function applyAction(s: GameState, a: GameAction, now: number): ApplyResult {
  if (s.phase !== 'playing') return { ok: false, error: 'Ván đã kết thúc' };
  if (a.type === 'pass') {
    if (a.seat !== s.turn) return { ok: false, error: 'Chưa tới lượt bạn' };
    if (!s.lastPlay) return { ok: false, error: 'Bạn đang được ra bài, không thể bỏ lượt' };
    let ns: GameState = { ...s, passed: s.passed.map((p, i) => (i === a.seat ? true : p)), moveNo: s.moveNo + 1 };
    ns = pushEvent(ns, { type: 'pass', seat: a.seat });
    ns = advance(ns, a.seat, now);
    return { ok: true, state: ns };
  }

  const check = checkPlay(s, a.seat, a.cards, s.hands[a.seat]);
  if (!check.ok) return check;
  const { combo, chop, interrupt } = check;
  const seat = a.seat;
  const hand = removeCards(s.hands[seat], a.cards)!;

  let chopPending = s.chopPending;
  let victim: number | undefined;
  if (chop && s.lastPlay) {
    victim = s.lastPlay.seat;
    const carried = chopPending && chopPending.to === victim ? chopPending.amount : 0;
    const amount = chopValue(s.lastPlay.combo) + carried;
    chopPending = { from: victim, to: seat, amount, reason: `Bị chặt ${comboName(s.lastPlay.combo).toLowerCase()}` };
  }

  const play: Play = { seat, cards: combo.cards, combo, chop };
  let ns: GameState = {
    ...s,
    hands: s.hands.map((h, i) => (i === seat ? hand : h)),
    playedAny: s.playedAny.map((p, i) => (i === seat ? true : p)),
    playedCards: [...s.playedCards, ...combo.cards],
    passed: interrupt ? s.passed.map((p, i) => (i === seat ? false : p)) : s.passed,
    lastPlay: play,
    trickPlays: [...s.trickPlays, play],
    mustPlay3S: false,
    chopPending,
    moveNo: s.moveNo + 1,
  };
  ns = pushEvent(ns, { type: 'play', seat, cards: combo.cards, label: comboName(combo), chop, victim });

  if (hand.length === 0) {
    ns = finishSeat(ns, seat);
    if (ns.phase === 'ended') return { ok: true, state: ns };
  }
  ns = advance(ns, seat, now);
  return { ok: true, state: ns };
}

function finishSeat(s: GameState, seat: number): GameState {
  let ns: GameState = { ...s, finished: [...s.finished, seat] };
  ns = pushEvent(ns, { type: 'finish', seat, place: ns.finished.length });

  if (ns.mode === 'team') return endGame(ns);

  if (ns.finished.length === 1 && ns.rules.penalties) {
    const cong = [0, 1, 2, 3].filter((i) => i !== seat && !ns.playedAny[i]);
    if (cong.length) {
      ns = { ...ns, cong };
      ns = pushEvent(ns, { type: 'cong', seats: cong });
    }
  }
  if (!ns.rules.playToEnd) return endGame(ns);
  const active = [0, 1, 2, 3].filter((i) => !isOut(ns, i));
  if (active.length <= 1) return endGame(ns);
  return ns;
}

/** Move the turn on after `from` acted. Starts a new round when everybody else passed. */
function advance(s: GameState, from: number, now: number): GameState {
  for (let i = 1; i <= 4; i++) {
    const c = (from + i) % 4;
    if (isOut(s, c) || s.passed[c]) continue;
    if (s.lastPlay && c === s.lastPlay.seat) return newRound(s, c, now);
    return { ...s, turn: c, turnStartedAt: now };
  }
  // Nobody left in this trick and the last player already finished: next player after them leads.
  const base = s.lastPlay ? s.lastPlay.seat : from;
  for (let i = 1; i <= 4; i++) {
    const c = (base + i) % 4;
    if (!isOut(s, c)) return newRound(s, c, now);
  }
  return s;
}

function newRound(s: GameState, leader: number, now: number): GameState {
  const ns: GameState = {
    ...s,
    transfers: s.chopPending ? [...s.transfers, s.chopPending] : s.transfers,
    chopPending: null,
    lastPlay: null,
    trickPlays: [],
    passed: [false, false, false, false],
    turn: leader,
    turnStartedAt: now,
  };
  return pushEvent(ns, { type: 'newRound', leader });
}

const SOLO_BASE = [3, 1, -1, -3];
const CONG_PENALTY = 6;
const TEAM_BASE = 2;
const INSTANT_WIN_PAY = 4;

function endGame(s: GameState): GameState {
  const transfers = s.chopPending ? [...s.transfers, s.chopPending] : [...s.transfers];
  const deltas = [0, 0, 0, 0];
  const winner = s.finished[0];
  const remaining = [0, 1, 2, 3]
    .filter((i) => !s.finished.includes(i) && !s.cong.includes(i))
    .sort((a, b) => s.hands[a].length - s.hands[b].length || a - b);
  const ranking = [...s.finished, ...remaining, ...s.cong];
  const thoi: GameResult['thoi'] = [];
  let winnerTeam: 0 | 1 | null = null;

  if (s.mode === 'team') {
    winnerTeam = teamOf(winner);
    for (let i = 0; i < 4; i++) deltas[i] += teamOf(i) === winnerTeam ? TEAM_BASE : -TEAM_BASE;
  } else {
    ranking.forEach((seat, place) => (deltas[seat] += SOLO_BASE[place]));
    if (s.rules.penalties) {
      for (const c of s.cong) transfers.push({ from: c, to: winner, amount: CONG_PENALTY, reason: 'Cóng' });
      const losers = new Set([ranking[3], ...s.cong]);
      for (const seat of losers) {
        const items = thoiItems(s.hands[seat]);
        if (items.length) {
          thoi.push({ seat, items });
          const amount = items.reduce((a, b) => a + b.value, 0);
          transfers.push({ from: seat, to: winner, amount, reason: `Thối ${items.map((x) => x.label.toLowerCase()).join(', ')}` });
        }
      }
    }
  }
  for (const t of transfers) {
    deltas[t.from] -= t.amount;
    deltas[t.to] += t.amount;
  }
  const result: GameResult = { ranking, winnerTeam, instantWin: null, cong: s.cong, thoi, transfers, deltas };
  return pushEvent({ ...s, phase: 'ended', chopPending: null, transfers, lastPlay: s.lastPlay, result }, { type: 'end' });
}

function endInstantWin(s: GameState, seat: number, kind: InstantWinKind): GameState {
  const deltas = [0, 0, 0, 0];
  let winnerTeam: 0 | 1 | null = null;
  if (s.mode === 'team') {
    winnerTeam = teamOf(seat);
    for (let i = 0; i < 4; i++) deltas[i] = teamOf(i) === winnerTeam ? INSTANT_WIN_PAY : -INSTANT_WIN_PAY;
  } else {
    for (let i = 0; i < 4; i++) deltas[i] = i === seat ? INSTANT_WIN_PAY * 3 : -INSTANT_WIN_PAY;
  }
  const others = [0, 1, 2, 3].filter((i) => i !== seat);
  const result: GameResult = {
    ranking: [seat, ...others],
    winnerTeam,
    instantWin: { seat, kind, label: INSTANT_WIN_NAMES[kind] },
    cong: [],
    thoi: [],
    transfers: [],
    deltas,
  };
  return pushEvent({ ...s, phase: 'ended', finished: [seat], result }, { type: 'end' });
}

// ---------------------------------------------------------------------------
// Per-player view (hides other hands). Bots and remote players only ever see this.

export interface GameView {
  id: string;
  mode: GameMode;
  rules: RuleSettings;
  players: PlayerInfo[];
  mySeat: number;
  myHand: Card[];
  handCounts: number[];
  turn: number;
  phase: 'playing' | 'ended';
  lastPlay: Play | null;
  trickPlays: Play[];
  passed: boolean[];
  mustPlay3S: boolean;
  playedAny: boolean[];
  finished: number[];
  cong: number[];
  playedCards: Card[];
  moveNo: number;
  turnStartedAt: number;
  events: GameEvent[];
  result: GameResult | null;
  /** all hands, only revealed once the game has ended */
  revealedHands: Card[][] | null;
}

export function toView(s: GameState, seat: number): GameView {
  return {
    id: s.id,
    mode: s.mode,
    rules: s.rules,
    players: s.players,
    mySeat: seat,
    myHand: s.hands[seat] ?? [],
    handCounts: s.hands.map((h) => h.length),
    turn: s.turn,
    phase: s.phase,
    lastPlay: s.lastPlay,
    trickPlays: s.trickPlays,
    passed: s.passed,
    mustPlay3S: s.mustPlay3S,
    playedAny: s.playedAny,
    finished: s.finished,
    cong: s.cong,
    playedCards: s.playedCards,
    moveNo: s.moveNo,
    turnStartedAt: s.turnStartedAt,
    events: s.events,
    result: s.result,
    revealedHands: s.phase === 'ended' ? s.hands : null,
  };
}

export function describeEvent(e: GameEvent, players: PlayerInfo[]): string {
  const n = (i: number) => players[i]?.name ?? `Ghế ${i + 1}`;
  switch (e.type) {
    case 'deal': return `Chia bài. ${n(e.leader)} đi trước.`;
    case 'play': return e.chop && e.victim != null
      ? `${n(e.seat)} chặt ${n(e.victim)} bằng ${e.label.toLowerCase()}!`
      : `${n(e.seat)}: ${e.label} ${e.cards.map(cardLabel).join(' ')}`;
    case 'pass': return `${n(e.seat)} bỏ lượt`;
    case 'newRound': return `${n(e.leader)} được ra bài mới`;
    case 'finish': return `${n(e.seat)} về ${['nhất', 'nhì', 'ba', 'bét'][e.place - 1]}!`;
    case 'cong': return `${e.seats.map(n).join(', ')} bị cóng!`;
    case 'instantWin': return `${n(e.seat)} tới trắng: ${INSTANT_WIN_NAMES[e.kind]}!`;
    case 'end': return 'Kết thúc ván';
  }
}
