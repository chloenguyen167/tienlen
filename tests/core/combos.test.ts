import { describe, it, expect } from 'vitest';
import { detectCombo } from '../../src/core/combos';
import { canBeat, detectInstantWin, thoiItems } from '../../src/core/rules';
import { DEFAULT_RULES } from '../../src/core/settings';
import { cs } from './helpers';

const d = (s: string) => detectCombo(cs(s));

describe('detectCombo', () => {
  it('detects basic shapes', () => {
    expect(d('3s')?.type).toBe('single');
    expect(d('3s 3h')?.type).toBe('pair');
    expect(d('3s 3h 3d')?.type).toBe('triple');
    expect(d('9s 9h 9d 9c')?.type).toBe('quad');
    expect(d('3s 4h 5d')?.type).toBe('straight');
    expect(d('10s Jh Qd Kc As')?.size).toBe(5);
    expect(d('3s 3h 4d 4c 5s 5h')?.type).toBe('pairSeq');
    expect(d('3s 3h 4d 4c 5s 5h 6s 6h')?.size).toBe(4);
  });
  it('rejects invalid shapes', () => {
    expect(d('3s 4h')).toBeNull();
    expect(d('3s 5h 6d')).toBeNull();
    expect(d('Qs Kh Ad 2c')).toBeNull(); // 2 cannot be in a straight
    expect(d('Ks Kh As Ac 2s 2h')).toBeNull();
    expect(d('3s 3h 4d 4c')).toBeNull(); // only 2 pairs
    expect(d('3s 3h 3d 3c 3s')).toBeNull();
  });
});

describe('canBeat', () => {
  const R = DEFAULT_RULES;
  const beat = (a: string, b: string, wasChop = false) => canBeat(d(a), d(b)!, R, wasChop);
  it('same shape compares top card incl. suit', () => {
    expect(beat('5s', '5h')).toBe('normal');
    expect(beat('5h', '5s')).toBe(false);
    expect(beat('As', '2s')).toBe('normal');
    expect(beat('3s 4s 5s', '3h 4h 5h')).toBe('normal');
    expect(beat('3s 4s 5s', '4s 5s 6s 7s')).toBe(false); // different length
    expect(beat('7s 7c', '7d 7h')).toBe('normal');
  });
  it('chops', () => {
    expect(beat('2h', '3s 3h 4d 4c 5s 5h')).toBe('chop');
    expect(beat('2h 2d', '3s 3h 4d 4c 5s 5h')).toBe(false);
    expect(beat('2h', '9s 9h 9d 9c')).toBe('chop');
    expect(beat('2h 2d', '9s 9h 9d 9c')).toBe('chop');
    expect(beat('3s 3h 4d 4c 5s 5h', '9s 9h 9d 9c')).toBe('chop');
    expect(beat('9s 9h 9d 9c', '3s 3h 4d 4c 5s 5h 6s 6h')).toBe('chop');
    expect(beat('2s 2c', '3s 3h 4d 4c 5s 5h 6s 6h')).toBe('chop');
    expect(beat('Ks', '9s 9h 9d 9c')).toBe(false);
  });
  it('respects rule toggles', () => {
    expect(canBeat(d('2h'), d('9s 9h 9d 9c')!, { ...R, allowChop: false })).toBe(false);
    expect(canBeat(d('3s 3h 4d 4c 5s 5h'), d('9s 9h 9d 9c')!, { ...R, chopStack: false }, true)).toBe(false);
  });
});

describe('instant win', () => {
  it('detects', () => {
    expect(detectInstantWin(cs('2s 2c 2d 2h 3s 4s 5s 6s 7s 8s 9s 10s Js'))).toBe('fourTwos');
    expect(detectInstantWin(cs('3s 4s 5s 6s 7s 8s 9s 10s Js Qs Ks As 3h'))).toBe('dragon');
    expect(detectInstantWin(cs('3s 3h 4s 4h 5s 5h 6s 6h 7s 7h Js Qd 2s'))).toBe('fivePairSeq');
    expect(detectInstantWin(cs('3s 3h 5s 5h 7s 7h 9s 9h Js Jh Ks Kh 2s'))).toBe('sixPairs');
    expect(detectInstantWin(cs('3s 3h 5s 5h 7s 7h 9s 9h Js Jh Ks Ah 2s'))).toBeNull();
  });
  it('thoi items', () => {
    const items = thoiItems(cs('2s 2h 9s 9h 9d 9c 3s 3h 4s 4h 5s 5h'));
    expect(items.map((i) => i.label).sort()).toEqual(['3 đôi thông', 'Heo đen', 'Heo đỏ', 'Tứ quý'].sort());
  });
});
