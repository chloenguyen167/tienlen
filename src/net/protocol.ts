import { GameAction, GameMode, GameView } from '../core/game';
import { RuleSettings } from '../core/settings';

export const PEER_PREFIX = 'tienlen-v1-';
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PROTOCOL_VERSION = 1;

export function makeRoomCode(): string {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export const normalizeCode = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export const peerIdFor = (code: string): string => PEER_PREFIX + code;

export interface SeatInfo {
  kind: 'human' | 'bot';
  name: string;
  avatar: string;
  /** humans only */
  token?: string;
  connected: boolean;
}

export interface ChatMsg {
  id: number;
  seat: number;
  name: string;
  text: string;
  at: number;
}

/** What every client knows about the room. */
export interface RoomPublic {
  code: string;
  online: boolean;
  mode: GameMode;
  rules: RuleSettings;
  seats: SeatInfo[];
  totals: number[];
  gamesPlayed: number;
  inGame: boolean;
}

export type GuestMsg =
  | { t: 'hello'; v: number; token: string; name: string; avatar: string }
  | { t: 'action'; action: GameAction }
  | { t: 'chat'; text: string }
  | { t: 'ping' }
  | { t: 'leave' };

export type HostMsg =
  | { t: 'welcome'; seat: number }
  | { t: 'room'; room: RoomPublic }
  | { t: 'view'; view: GameView | null; deadlineIn: number | null }
  | { t: 'chat'; msg: ChatMsg }
  | { t: 'error'; msg: string }
  | { t: 'reject'; msg: string }
  | { t: 'pong' }
  | { t: 'closed' };

export const SEAT_FILL_ORDER = [2, 1, 3];

export const BOT_NAMES = ['Bot Mít', 'Bot Xoài', 'Bot Chôm', 'Bot Ổi'];
export const AVATARS = ['🐯', '🦊', '🐼', '🐸', '🐵', '🐧', '🦁', '🐨', '🐰', '🐻', '🐶', '🐱', '🦄', '🐲', '🐙', '🦉'];
export const BOT_AVATAR = '🤖';
