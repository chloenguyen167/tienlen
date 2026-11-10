import { describe, it, expect } from 'vitest';
import { applyAction, createGame, GameState, toView, isOut } from '../../src/core/game';
import { DEFAULT_RULES, BotLevel, RuleSettings } from '../../src/core/settings';
import { chooseBotAction, botInterrupt } from '../../src/ai/bot';
import { mulberry32 } from '../../src/core/rng';

const players = [0, 1, 2, 3].map((i) => ({ name: `B${i}`, avatar: '🤖', isBot: true }));

function simulate(seed: number, mode: 'solo' | 'team', levels: BotLevel[], rules: RuleSettings) {
  const rand = mulberry32(seed);
  let s: GameState = createGame({ id: String(seed), mode, rules, players, seed, now: 0, leader: seed % 3 === 0 ? null : seed % 4 });
  let steps = 0;
  while (s.phase === 'playing') {
    if (++steps > 400) throw new Error(`stuck game seed=${seed}`);
    // out-of-turn chops first
    let acted = false;
    for (let seat = 0; seat < 4 && !acted; seat++) {
      if (seat === s.turn || isOut(s, seat)) continue;
      const a = botInterrupt(toView(s, seat), levels[seat], rand);
      if (a) {
        const r = applyAction(s, a, steps);
        if (!r.ok) throw new Error(`illegal interrupt seed=${seed}: ${r.error}`);
        s = r.state;
        acted = true;
      }
    }
    if (acted) continue;
    const a = chooseBotAction(toView(s, s.turn), levels[s.turn], rand);
    const r = applyAction(s, a, steps);
    if (!r.ok) throw new Error(`illegal move seed=${seed} level=${levels[s.turn]}: ${r.error} ${JSON.stringify(a)}`);
    s = r.state;
    const total = s.hands.reduce((n, h) => n + h.length, 0) + s.playedCards.length;
    expect(total).toBe(52);
  }
  const res = s.result!;
  expect(res.deltas.reduce((a, b) => a + b, 0)).toBe(0);
  expect(new Set(res.ranking).size).toBe(4);
  return res;
}

describe('bot simulation', () => {
  it('1000 games finish legally with zero-sum scores', () => {
    const lv: BotLevel[] = ['easy', 'medium', 'hard'];
    const wins: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
    for (let i = 0; i < 1000; i++) {
      const levels = [0, 1, 2, 3].map((k) => lv[(i + k) % 3]);
      const mode = i % 4 === 0 ? 'team' : 'solo';
      const rules = { ...DEFAULT_RULES, playToEnd: i % 5 !== 0, penalties: i % 7 !== 0 };
      const res = simulate(i + 1, mode, levels, rules);
      wins[levels[res.ranking[0]]]++;
    }
    console.log('first places by level', wins);
    expect(wins.easy).toBeLessThan(wins.medium);
  });
});
