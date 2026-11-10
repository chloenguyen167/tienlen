import Peer, { DataConnection } from 'peerjs';
import { applyAction, createGame, GameAction, GameMode, GameState, isOut, toView } from '../core/game';
import { RuleSettings } from '../core/settings';
import { randomSeed } from '../core/rng';
import { botInterrupt, chooseBotAction, timeoutAction } from '../ai/bot';
import { saveJSON, removeKey, uid } from '../store/persistence';
import { Controller, ConnStatus, TableSnapshot } from './controller';
import {
  BOT_AVATAR, BOT_NAMES, ChatMsg, GuestMsg, HostMsg, PROTOCOL_VERSION, RoomPublic, SEAT_FILL_ORDER, SeatInfo, peerIdFor,
} from './protocol';

export interface HostRoomState {
  v: 1;
  code: string;
  online: boolean;
  mode: GameMode;
  rules: RuleSettings;
  seats: SeatInfo[];
  game: GameState | null;
  totals: number[];
  gamesPlayed: number;
  lastWinner: number | null;
  chat: ChatMsg[];
  chatSeq: number;
}

export interface HostPrefs {
  botDelay: () => number;
}

const HEARTBEAT_TIMEOUT = 12000;

export function newRoomState(o: {
  code: string;
  online: boolean;
  mode: GameMode;
  rules: RuleSettings;
  me: { token: string; name: string; avatar: string };
}): HostRoomState {
  const seats: SeatInfo[] = [0, 1, 2, 3].map((i) =>
    i === 0
      ? { kind: 'human', name: o.me.name, avatar: o.me.avatar, token: o.me.token, connected: true }
      : { kind: 'bot', name: BOT_NAMES[i - 1], avatar: BOT_AVATAR, connected: true },
  );
  return {
    v: 1, code: o.code, online: o.online, mode: o.mode, rules: o.rules, seats, game: null,
    totals: [0, 0, 0, 0], gamesPlayed: 0, lastWinner: null, chat: [], chatSeq: 0,
  };
}

/**
 * The authoritative side of a table. Runs the game reducer and the bots.
 * Used for both offline games (online = false) and as host of a P2P room.
 */
export class HostController implements Controller {
  readonly role: 'local' | 'host';
  private st: HostRoomState;
  private listeners = new Set<(s: TableSnapshot) => void>();
  private peer: Peer | null = null;
  private conns = new Map<string, DataConnection>(); // token → connection
  private lastSeen = new Map<string, number>(); // token → time
  private offlineSince = new Map<number, number>(); // seat → time
  private status: ConnStatus = 'online';
  private statusText = '';
  private timers: ReturnType<typeof setTimeout>[] = [];
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;
  private peerRetries = 0;

  constructor(state: HostRoomState, private storageKey: string, private prefs: HostPrefs) {
    this.role = state.online ? 'host' : 'local';
    // After a reload give whoever is on turn a fresh timer.
    if (state.game && state.game.phase === 'playing') state = { ...state, game: { ...state.game, turnStartedAt: Date.now() } };
    // Remote players are offline until they reconnect.
    this.st = {
      ...state,
      seats: state.seats.map((s, i) => (i === 0 || s.kind === 'bot' ? s : { ...s, connected: false })),
    };
    const now = Date.now();
    this.st.seats.forEach((s, i) => { if (s.kind === 'human' && !s.connected) this.offlineSince.set(i, now); });
    this.persist();
    if (this.st.online) {
      this.status = 'connecting';
      this.statusText = 'Đang mở phòng…';
      this.openPeer();
      this.heartbeat = setInterval(() => this.checkHeartbeats(), 3000);
    }
    this.schedule();
  }

  // ------------------------------------------------------------------ public API

  snapshot(): TableSnapshot {
    const g = this.st.game;
    const deadline = this.turnDeadline();
    const waiting: Record<number, number> = {};
    for (const [seat, since] of this.offlineSince) waiting[seat] = since + this.st.rules.disconnectSeconds * 1000;
    return {
      role: this.role,
      room: this.publicRoom(),
      mySeat: 0,
      view: g ? toView(g, 0) : null,
      deadline,
      status: this.status,
      statusText: this.statusText,
      chat: this.st.chat,
      waiting,
    };
  }

  subscribe(fn: (s: TableSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  act(action: GameAction): string | null {
    if (action.seat !== 0) return 'Sai ghế';
    return this.apply(action);
  }

  chat(text: string): void {
    this.addChat(0, text);
  }

  startGame(): void {
    const g = this.st.game;
    if (g && g.phase === 'playing') return;
    const players = this.st.seats.map((s) => ({ name: s.name, avatar: s.avatar, isBot: s.kind === 'bot' }));
    const game = createGame({
      id: uid(8),
      mode: this.st.mode,
      rules: this.st.rules,
      players,
      seed: randomSeed(),
      leader: this.st.lastWinner,
      now: Date.now(),
    });
    this.st = { ...this.st, game };
    if (game.phase === 'ended') this.onGameEnded();
    this.changed();
  }

  setRules(rules: RuleSettings): void {
    if (this.st.game && this.st.game.phase === 'playing') return;
    this.st = { ...this.st, rules };
    this.changed();
  }

  setMode(mode: GameMode): void {
    if (this.st.game && this.st.game.phase === 'playing') return;
    if (mode === this.st.mode) return;
    // Team: humans sit opposite (0 & 2). Reset scores since teams changed.
    this.st = { ...this.st, mode, totals: [0, 0, 0, 0], gamesPlayed: 0, lastWinner: null, game: null };
    this.changed();
  }

  /** Host removes a remote player; their seat goes back to a bot. */
  kick(seat: number): void {
    const s = this.st.seats[seat];
    if (seat === 0 || s.kind !== 'human' || !s.token) return;
    const conn = this.conns.get(s.token);
    if (conn) this.send(conn, { t: 'reject', msg: 'Chủ phòng đã mời bạn ra khỏi phòng' });
    this.onLeave(seat, s.token);
  }

  leave(): void {
    this.broadcast({ t: 'closed' });
    removeKey(this.storageKey);
    this.shutdown();
  }

  destroy(): void {
    this.persist();
    this.shutdown();
  }

  // ------------------------------------------------------------------ game loop

  private apply(action: GameAction): string | null {
    const g = this.st.game;
    if (!g) return 'Chưa bắt đầu ván';
    const r = applyAction(g, action, Date.now());
    if (!r.ok) return r.error;
    this.st = { ...this.st, game: r.state };
    if (r.state.phase === 'ended') this.onGameEnded();
    this.changed();
    return null;
  }

  private onGameEnded(): void {
    const res = this.st.game!.result!;
    this.st = {
      ...this.st,
      totals: this.st.totals.map((t, i) => t + res.deltas[i]),
      gamesPlayed: this.st.gamesPlayed + 1,
      lastWinner: res.ranking[0],
    };
  }

  private turnDeadline(): number | null {
    const g = this.st.game;
    if (!g || g.phase !== 'playing' || !g.rules.turnSeconds) return null;
    if (this.isBotControlled(g.turn)) return null;
    return g.turnStartedAt + g.rules.turnSeconds * 1000;
  }

  /** Bot seats, plus humans who have been offline longer than the grace period. */
  private isBotControlled(seat: number): boolean {
    const s = this.st.seats[seat];
    if (s.kind === 'bot') return true;
    const since = this.offlineSince.get(seat);
    return since !== undefined && Date.now() - since >= this.st.rules.disconnectSeconds * 1000;
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(() => { if (!this.destroyed) fn(); }, Math.max(0, ms)));
  }

  /** Decide who acts next and set the timers that make bots / timeouts happen. */
  private schedule(): void {
    this.clearTimers();
    const g = this.st.game;
    if (!g || g.phase !== 'playing' || this.destroyed) return;
    const level = g.rules.botLevel;

    // 4 đôi thông out-of-turn chops by bots.
    for (let seat = 0; seat < 4; seat++) {
      if (seat === g.turn || isOut(g, seat) || !this.isBotControlled(seat)) continue;
      const a = botInterrupt(toView(g, seat), level);
      if (a) {
        this.later(this.prefs.botDelay() * 0.7, () => this.apply(a));
        return;
      }
    }

    const seat = g.turn;
    if (this.isBotControlled(seat)) {
      const moveNo = g.moveNo;
      this.later(this.prefs.botDelay(), () => {
        const cur = this.st.game;
        if (!cur || cur.moveNo !== moveNo || cur.phase !== 'playing') return;
        const lv = this.st.seats[seat].kind === 'bot' ? level : 'medium';
        const err = this.apply(chooseBotAction(toView(cur, seat), lv));
        if (err) this.apply(timeoutAction(toView(cur, seat))); // should never happen, but never stall
      });
      return;
    }

    // Offline human: wait for the grace period, then a bot takes over.
    const since = this.offlineSince.get(seat);
    if (since !== undefined) {
      this.later(since + g.rules.disconnectSeconds * 1000 - Date.now() + 50, () => this.changed());
    }
    const deadline = this.turnDeadline();
    if (deadline !== null) {
      const moveNo = g.moveNo;
      this.later(deadline - Date.now(), () => {
        const cur = this.st.game;
        if (!cur || cur.moveNo !== moveNo || cur.phase !== 'playing') return;
        this.apply(timeoutAction(toView(cur, seat)));
      });
    }
  }

  private changed(): void {
    this.persist();
    this.schedule();
    const snap = this.snapshot();
    this.listeners.forEach((fn) => fn(snap));
    this.syncGuests();
  }

  private persist(): void {
    saveJSON(this.storageKey, this.st);
  }

  private publicRoom(): RoomPublic {
    return {
      code: this.st.code,
      online: this.st.online,
      mode: this.st.mode,
      rules: this.st.rules,
      seats: this.st.seats.map(({ token: _t, ...s }) => s),
      totals: this.st.totals,
      gamesPlayed: this.st.gamesPlayed,
      inGame: !!this.st.game && this.st.game.phase === 'playing',
    };
  }

  private addChat(seat: number, text: string): void {
    const clean = text.trim().slice(0, 120);
    if (!clean) return;
    const msg: ChatMsg = { id: this.st.chatSeq + 1, seat, name: this.st.seats[seat].name, text: clean, at: Date.now() };
    this.st = { ...this.st, chat: [...this.st.chat, msg].slice(-40), chatSeq: msg.id };
    this.broadcast({ t: 'chat', msg });
    this.persist();
    const snap = this.snapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  // ------------------------------------------------------------------ networking

  private setStatus(status: ConnStatus, text: string): void {
    this.status = status;
    this.statusText = text;
    const snap = this.snapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  private openPeer(): void {
    if (this.destroyed) return;
    const peer = new Peer(peerIdFor(this.st.code), { debug: 0 });
    this.peer = peer;
    peer.on('open', () => {
      this.peerRetries = 0;
      this.setStatus('online', '');
    });
    peer.on('connection', (conn) => this.onConnection(conn));
    peer.on('disconnected', () => {
      if (this.destroyed || this.peer !== peer) return;
      this.setStatus('reconnecting', 'Mất kết nối máy chủ mời, đang thử lại…');
      setTimeout(() => { if (!this.destroyed && peer.disconnected && !peer.destroyed) peer.reconnect(); }, 2000);
    });
    peer.on('error', (err: { type?: string }) => {
      if (this.destroyed || this.peer !== peer) return;
      if (err.type === 'unavailable-id') {
        // The old session for this room is still registered (e.g. right after a reload). Retry.
        peer.destroy();
        this.peerRetries++;
        this.setStatus('reconnecting', 'Đang khôi phục phòng…');
        setTimeout(() => this.openPeer(), Math.min(2000 + this.peerRetries * 1000, 6000));
      } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
        this.setStatus('reconnecting', 'Mạng không ổn định, đang thử lại…');
        peer.destroy();
        setTimeout(() => this.openPeer(), 4000);
      } else if (err.type === 'browser-incompatible') {
        this.setStatus('error', 'Trình duyệt không hỗ trợ WebRTC');
      }
    });
  }

  private onConnection(conn: DataConnection): void {
    let token: string | null = null;
    conn.on('data', (raw) => {
      const msg = raw as GuestMsg;
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'hello') {
        token = this.onHello(conn, msg);
        return;
      }
      if (!token) return;
      this.lastSeen.set(token, Date.now());
      const seat = this.seatOf(token);
      if (seat < 0) return;
      switch (msg.t) {
        case 'ping':
          this.send(conn, { t: 'pong' });
          if (!this.st.seats[seat].connected) this.markOnline(seat);
          break;
        case 'action': {
          if (!msg.action || msg.action.seat !== seat) return;
          const err = this.apply(msg.action);
          if (err) this.send(conn, { t: 'error', msg: err });
          break;
        }
        case 'chat':
          this.addChat(seat, String(msg.text ?? ''));
          break;
        case 'leave':
          this.onLeave(seat, token);
          break;
      }
    });
    conn.on('close', () => {
      if (token && this.conns.get(token) === conn) this.markOffline(token);
    });
    conn.on('error', () => {
      if (token && this.conns.get(token) === conn) this.markOffline(token);
    });
  }

  private seatOf(token: string): number {
    return this.st.seats.findIndex((s) => s.kind === 'human' && s.token === token);
  }

  private onHello(conn: DataConnection, msg: Extract<GuestMsg, { t: 'hello' }>): string | null {
    if (msg.v !== PROTOCOL_VERSION) {
      this.send(conn, { t: 'reject', msg: 'Phiên bản game khác nhau, hãy tải lại trang' });
      return null;
    }
    const token = String(msg.token);
    const name = String(msg.name || 'Bạn').slice(0, 16);
    const avatar = String(msg.avatar || '🙂').slice(0, 4);
    let seat = this.seatOf(token);
    if (seat === 0) {
      this.send(conn, { t: 'reject', msg: 'Bạn đang là chủ phòng này ở tab khác' });
      return null;
    }
    if (seat < 0) {
      if (this.st.game && this.st.game.phase === 'playing') {
        this.send(conn, { t: 'reject', msg: 'Phòng đang chơi, hãy đợi hết ván rồi vào lại' });
        return null;
      }
      seat = SEAT_FILL_ORDER.find((i) => this.st.seats[i].kind === 'bot') ?? -1;
      if (seat < 0) {
        this.send(conn, { t: 'reject', msg: 'Phòng đã đủ người' });
        return null;
      }
    }
    const old = this.conns.get(token);
    if (old && old !== conn) old.close();
    this.conns.set(token, conn);
    this.lastSeen.set(token, Date.now());
    const seats = this.st.seats.map((s, i) => (i === seat ? { kind: 'human' as const, token, name, avatar, connected: true } : s));
    this.st = { ...this.st, seats };
    this.offlineSince.delete(seat);
    // Keep the in-game player list in sync with seat names.
    if (this.st.game) {
      const players = this.st.game.players.map((p, i) => (i === seat ? { name, avatar, isBot: false } : p));
      this.st = { ...this.st, game: { ...this.st.game, players } };
    }
    this.send(conn, { t: 'welcome', seat });
    this.st.chat.slice(-15).forEach((m) => this.send(conn, { t: 'chat', msg: m }));
    this.changed();
    return token;
  }

  private onLeave(seat: number, token: string): void {
    const conn = this.conns.get(token);
    this.conns.delete(token);
    this.lastSeen.delete(token);
    this.offlineSince.delete(seat);
    const botName = BOT_NAMES[seat - 1] ?? 'Bot';
    this.st = {
      ...this.st,
      seats: this.st.seats.map((s, i) => (i === seat ? { kind: 'bot', name: botName, avatar: BOT_AVATAR, connected: true } : s)),
    };
    if (this.st.game) {
      const players = this.st.game.players.map((p, i) => (i === seat ? { name: botName, avatar: BOT_AVATAR, isBot: true } : p));
      this.st = { ...this.st, game: { ...this.st.game, players } };
    }
    conn?.close();
    this.changed();
  }

  private markOffline(token: string): void {
    const seat = this.seatOf(token);
    this.conns.delete(token);
    if (seat <= 0 || !this.st.seats[seat].connected) return;
    this.offlineSince.set(seat, Date.now());
    this.st = { ...this.st, seats: this.st.seats.map((s, i) => (i === seat ? { ...s, connected: false } : s)) };
    this.changed();
  }

  private markOnline(seat: number): void {
    this.offlineSince.delete(seat);
    this.st = { ...this.st, seats: this.st.seats.map((s, i) => (i === seat ? { ...s, connected: true } : s)) };
    this.changed();
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    for (const [token, seen] of this.lastSeen) {
      if (now - seen > HEARTBEAT_TIMEOUT) {
        this.lastSeen.delete(token);
        const conn = this.conns.get(token);
        this.markOffline(token);
        conn?.close();
      }
    }
  }

  private send(conn: DataConnection, msg: HostMsg): void {
    try {
      if (conn.open) conn.send(msg);
    } catch {
      /* connection dropped */
    }
  }

  private broadcast(msg: HostMsg): void {
    for (const conn of this.conns.values()) this.send(conn, msg);
  }

  private syncGuests(): void {
    if (!this.st.online) return;
    const room = this.publicRoom();
    const g = this.st.game;
    const deadline = this.turnDeadline();
    for (const [token, conn] of this.conns) {
      const seat = this.seatOf(token);
      if (seat < 0) continue;
      this.send(conn, { t: 'room', room });
      this.send(conn, { t: 'view', view: g ? toView(g, seat) : null, deadlineIn: deadline !== null ? deadline - Date.now() : null });
    }
  }

  private shutdown(): void {
    this.destroyed = true;
    this.clearTimers();
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.listeners.clear();
    for (const c of this.conns.values()) c.close();
    this.conns.clear();
    this.peer?.destroy();
    this.peer = null;
  }
}
