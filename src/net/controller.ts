import { GameAction, GameView } from '../core/game';
import { RuleSettings } from '../core/settings';
import { GameMode } from '../core/game';
import { ChatMsg, RoomPublic } from './protocol';

export type ConnStatus = 'connecting' | 'online' | 'reconnecting' | 'offline' | 'error';

export interface TableSnapshot {
  role: 'local' | 'host' | 'guest';
  room: RoomPublic | null;
  mySeat: number;
  view: GameView | null;
  /** local timestamp (ms) when the current turn times out, null = no timer */
  deadline: number | null;
  status: ConnStatus;
  statusText: string;
  chat: ChatMsg[];
  /** seats whose human player is offline and waiting to reconnect: seat → local timestamp when a bot takes over */
  waiting: Record<number, number>;
}

export interface Controller {
  readonly role: TableSnapshot['role'];
  snapshot(): TableSnapshot;
  subscribe(fn: (s: TableSnapshot) => void): () => void;
  act(action: GameAction): string | null;
  chat(text: string): void;
  startGame(): void;
  setRules(rules: RuleSettings): void;
  setMode(mode: GameMode): void;
  /** leave = forget saved session (user chose to quit) */
  leave(): void;
  /** destroy = stop timers/network but keep saved session (navigating away) */
  destroy(): void;
}
