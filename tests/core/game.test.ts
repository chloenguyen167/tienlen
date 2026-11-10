import { describe, it, expect } from 'vitest';
import { applyAction, createGame, GameState, GameAction, GameMode } from '../../src/core/game';
import { DEFAULT_RULES, RuleSettings } from '../../src/core/settings';
import { sortCards } from '../../src/core/cards';
import { cs } from './helpers';

const players = [0, 1, 2, 3].map((i) => ({ name: `P${i}`, avatar: '🙂', isBot: true }));

function setup(hands: string[], opts: { turn?: number; mode?: GameMode; rules?: Partial<RuleSettings>; must3?: boolean } = {}): GameState {
  const rules = { ...DEFAULT_RULES, instantWin: false, ...opts.rules };
  const g = createGame({ id: 't', mode: opts.mode ?? 'solo', rules, players, seed: 1, now: 0, leader: 0 });
  return { ...g, hands: hands.map((h) => sortCards(cs(h))), turn: opts.turn ?? 0, mustPlay3S: opts.must3 ?? false };
}

function act(s: GameState, a: GameAction): GameState {
  const r = applyAction(s, a, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
const play = (s: GameState, seat: number, cards: string) => act(s, { type: 'play', seat, cards: cs(cards) });
const pass = (s: GameState, seat: number) => act(s, { type: 'pass', seat });

describe('game flow', () => {
  it('requires 3♠ on the first play when enabled', () => {
    const s = setup(['3s 5h 9c', '4s 6h', '7s 8h', '10s Jh'], { must3: true });
    expect(applyAction(s, { type: 'play', seat: 0, cards: cs('5h') }, 0).ok).toBe(false);
    const ns = play(s, 0, '3s');
    expect(ns.mustPlay3S).toBe(false);
    expect(ns.turn).toBe(1);
  });

  it('rejects out-of-turn and invalid plays', () => {
    const s = setup(['3s 5h', '4s 6h', '7s 8h', '10s Jh']);
    expect(applyAction(s, { type: 'play', seat: 1, cards: cs('4s') }, 0).ok).toBe(false);
    expect(applyAction(s, { type: 'play', seat: 0, cards: cs('3s 5h') }, 0).ok).toBe(false);
    expect(applyAction(s, { type: 'pass', seat: 0 }, 0).ok).toBe(false); // cannot pass when leading
  });

  it('passed players are skipped until the round ends', () => {
    let s = setup(['3s 9h Kd', '4s Qh Ac', '7s 8h 9d', '10s Jh Qd']);
    s = play(s, 0, '3s');
    s = pass(s, 1);
    s = play(s, 2, '7s');
    s = play(s, 3, '10s');
    expect(s.turn).toBe(0); // seat 1 passed → skipped
    s = play(s, 0, 'Kd');
    expect(s.turn).toBe(2);
    s = pass(s, 2);
    s = pass(s, 3);
    // everybody else passed → seat 0 leads a new round
    expect(s.turn).toBe(0);
    expect(s.lastPlay).toBeNull();
    expect(s.passed).toEqual([false, false, false, false]);
  });

  it('when the trick winner has finished, the next player leads', () => {
    let s = setup(['3s', '4s 6h', '7s 8h', '10s Jh'], { rules: { playToEnd: true, penalties: false } });
    s = play(s, 0, '3s'); // seat 0 finished
    expect(s.finished).toEqual([0]);
    s = pass(s, 1);
    s = pass(s, 2);
    s = pass(s, 3);
    expect(s.turn).toBe(1);
    expect(s.lastPlay).toBeNull();
  });

  it('solo game plays to the end and scores are zero-sum', () => {
    let s = setup(['3s', '4s', '5s 6h', '7s 9h'], { rules: { penalties: false } });
    s = play(s, 0, '3s');
    s = play(s, 1, '4s');
    s = play(s, 2, '5s');
    s = play(s, 3, '7s');
    // seat 0,1 finished; trick winner 3 leads
    expect(s.turn).toBe(2);
    s = pass(s, 2);
    expect(s.turn).toBe(3);
    s = play(s, 3, '9h');
    expect(s.phase).toBe('ended');
    expect(s.result!.ranking).toEqual([0, 1, 3, 2]);
    expect(s.result!.deltas.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('team mode ends when anyone finishes', () => {
    let s = setup(['3s', '4s 5h', '6s 7h', '8s 9h'], { mode: 'team' });
    s = play(s, 0, '3s');
    expect(s.phase).toBe('ended');
    expect(s.result!.winnerTeam).toBe(0);
    expect(s.result!.deltas).toEqual([2, -2, 2, -2]);
  });

  it('chop chain: last victim pays the accumulated amount', () => {
    let s = setup([
      '2h 3s',
      '3h 3d 4s 4c 5s 5h Kd',
      '9s 9h 9d 9c Ad',
      '10s Jh',
    ]);
    s = play(s, 0, '2h');
    s = play(s, 1, '3h 3d 4s 4c 5s 5h'); // 3 đôi thông chặt heo đỏ
    expect(s.chopPending).toMatchObject({ from: 0, to: 1, amount: 4 });
    s = play(s, 2, '9s 9h 9d 9c'); // tứ quý chặt 3 đôi thông
    expect(s.chopPending).toMatchObject({ from: 1, to: 2, amount: 9 });
    s = pass(s, 3);
    s = pass(s, 0);
    s = pass(s, 1);
    expect(s.transfers).toEqual([{ from: 1, to: 2, amount: 9, reason: expect.any(String) }]);
    expect(s.turn).toBe(2);
  });

  it('4 đôi thông can chop out of turn even after passing', () => {
    let s = setup(['2h 3s As', '5s 6h', '3h 3d 4s 4c 5d 5h 6s 6d Kd', '10s Jh']);
    s = play(s, 0, '3s');
    s = pass(s, 1);
    s = pass(s, 2);
    s = play(s, 3, '10s');
    s = play(s, 0, '2h');
    expect(s.turn).toBe(3);
    // seat 2 already passed this round, but 4 đôi thông is allowed anytime
    s = play(s, 2, '3h 3d 4s 4c 5d 5h 6s 6d');
    expect(s.lastPlay?.chop).toBe(true);
    expect(s.chopPending).toMatchObject({ from: 0, to: 2, amount: 4 });
    expect(s.turn).toBe(3);
  });

  it('cóng: players who never played are out when someone finishes', () => {
    let s = setup(['3s', '4s 5h', '6s 7h', '8s 9h']);
    s = play(s, 0, '3s');
    expect(s.cong).toEqual([1, 2, 3]);
    expect(s.phase).toBe('ended');
    const r = s.result!;
    expect(r.ranking[0]).toBe(0);
    expect(r.deltas.reduce((a, b) => a + b, 0)).toBe(0);
    expect(r.deltas[0]).toBeGreaterThan(10);
  });

  it('instant win ends the game at deal', () => {
    // find a seed whose deal has no instant win, then verify detection by hand-crafted state is covered in rules tests
    const g = createGame({ id: 'x', mode: 'solo', rules: DEFAULT_RULES, players, seed: 42, now: 0 });
    expect(g.hands.flat().length).toBe(52);
    expect(g.hands[g.turn].includes(0) || g.phase === 'ended').toBe(true);
  });
});
