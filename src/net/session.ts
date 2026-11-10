import { create } from 'zustand';
import { GameMode } from '../core/game';
import { RuleSettings } from '../core/settings';
import { KEYS, loadJSON, removeKey } from '../store/persistence';
import { botDelay } from '../store/settingsStore';
import { displayName, useProfile } from '../store/profileStore';
import { Controller, TableSnapshot } from './controller';
import { HostController, HostRoomState, newRoomState } from './host';
import { GuestController, GuestSession } from './guest';
import { makeRoomCode } from './protocol';

/** Global, single active table (local game, hosted room or joined room). */
export const useTable = create<{ snap: TableSnapshot | null }>(() => ({ snap: null }));

let current: Controller | null = null;
let currentKey = '';
let unsub: (() => void) | null = null;

const me = () => {
  const p = useProfile.getState();
  return { token: p.id, name: displayName(), avatar: p.avatar };
};

function attach(c: Controller, key: string): Controller {
  detach();
  current = c;
  currentKey = key;
  unsub = c.subscribe((snap) => useTable.setState({ snap }));
  return c;
}

/** Stop the active table but keep it saved so it can be resumed. */
export function detach(): void {
  unsub?.();
  unsub = null;
  current?.destroy();
  current = null;
  currentKey = '';
  useTable.setState({ snap: null });
}

/** Quit the active table for good (removes the saved session). */
export function leaveCurrent(): void {
  unsub?.();
  unsub = null;
  current?.leave();
  current = null;
  currentKey = '';
  useTable.setState({ snap: null });
}

export const getController = (): Controller | null => current;
export const currentTableKey = (): string => currentKey;

// ------------------------------------------------------------------ saved sessions

export const savedLocal = (): HostRoomState | null => loadJSON<HostRoomState>(KEYS.local);
export const savedHost = (): HostRoomState | null => loadJSON<HostRoomState>(KEYS.host);
export const savedGuest = (): GuestSession | null => loadJSON<GuestSession>(KEYS.guest);

function withMe(state: HostRoomState): HostRoomState {
  const m = me();
  const seats = state.seats.map((s, i) => (i === 0 ? { ...s, name: m.name, avatar: m.avatar, token: m.token } : s));
  const game = state.game
    ? { ...state.game, players: state.game.players.map((p, i) => (i === 0 ? { ...p, name: m.name, avatar: m.avatar } : p)) }
    : null;
  return { ...state, seats, game };
}

// ------------------------------------------------------------------ local (offline vs bots)

export function startLocal(mode: GameMode, rules: RuleSettings): Controller {
  removeKey(KEYS.local);
  const st = newRoomState({ code: 'LOCAL', online: false, mode, rules, me: me() });
  const c = attach(new HostController(st, KEYS.local, { botDelay }), 'local');
  c.startGame();
  return c;
}

export function resumeLocal(): Controller | null {
  if (current && currentKey === 'local') return current;
  const st = savedLocal();
  if (!st) return null;
  return attach(new HostController(withMe(st), KEYS.local, { botDelay }), 'local');
}

// ------------------------------------------------------------------ online

export function createHostRoom(mode: GameMode, rules: RuleSettings): string {
  // Only one hosted room per browser.
  const old = savedHost();
  if (old) removeKey(KEYS.host);
  const code = makeRoomCode();
  const st = newRoomState({ code, online: true, mode, rules, me: me() });
  attach(new HostController(st, KEYS.host, { botDelay }), `room:${code}`);
  return code;
}

/** Open the room screen for `code`: resume as host if we own it, otherwise join as guest. */
export function openRoom(code: string): Controller {
  const key = `room:${code}`;
  if (current && currentKey === key) return current;
  const host = savedHost();
  if (host && host.code === code) {
    return attach(new HostController(withMe(host), KEYS.host, { botDelay }), key);
  }
  const m = me();
  const session: GuestSession = { code, token: m.token, name: m.name, avatar: m.avatar };
  return attach(new GuestController(session, KEYS.guest), key);
}
