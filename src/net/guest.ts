import Peer, { DataConnection } from 'peerjs';
import { checkPlay, GameAction, GameView } from '../core/game';
import { removeKey, saveJSON } from '../store/persistence';
import { Controller, ConnStatus, TableSnapshot } from './controller';
import { ChatMsg, GuestMsg, HostMsg, PROTOCOL_VERSION, RoomPublic, peerIdFor } from './protocol';

export interface GuestSession {
  code: string;
  token: string;
  name: string;
  avatar: string;
}

const PING_EVERY = 4000;
const HOST_SILENT_TIMEOUT = 12000;

/** A remote player. Sends intents to the host and renders whatever view the host sends back. */
export class GuestController implements Controller {
  readonly role = 'guest' as const;
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private room: RoomPublic | null = null;
  private view: GameView | null = null;
  private deadline: number | null = null;
  private seat = -1;
  private chatLog: ChatMsg[] = [];
  private status: ConnStatus = 'connecting';
  private statusText = 'Đang kết nối tới phòng…';
  private listeners = new Set<(s: TableSnapshot) => void>();
  private destroyed = false;
  private rejected = false;
  private retry = 0;
  private lastHostMsg = 0;
  private connectStartedAt = 0;
  private ping: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private session: GuestSession, private storageKey: string) {
    saveJSON(storageKey, session);
    this.connect();
    this.ping = setInterval(() => this.tick(), PING_EVERY);
  }

  snapshot(): TableSnapshot {
    const waiting: Record<number, number> = {};
    if (this.room && this.view?.phase === 'playing') {
      this.room.seats.forEach((s, i) => {
        if (s.kind === 'human' && !s.connected) waiting[i] = 0;
      });
    }
    return {
      role: 'guest',
      room: this.room,
      mySeat: this.seat,
      view: this.view,
      deadline: this.deadline,
      status: this.status,
      statusText: this.statusText,
      chat: this.chatLog,
      waiting,
    };
  }

  subscribe(fn: (s: TableSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  act(action: GameAction): string | null {
    if (!this.conn?.open) return 'Đang mất kết nối với chủ phòng';
    if (!this.view) return 'Chưa bắt đầu ván';
    if (action.type === 'play') {
      const chk = checkPlay(this.view, this.seat, action.cards, this.view.myHand);
      if (!chk.ok) return chk.error;
    } else if (this.view.turn !== this.seat) {
      return 'Chưa tới lượt bạn';
    }
    this.send({ t: 'action', action });
    return null;
  }

  chat(text: string): void {
    this.send({ t: 'chat', text });
  }

  startGame(): void { /* host only */ }
  setRules(): void { /* host only */ }
  setMode(): void { /* host only */ }

  leave(): void {
    this.send({ t: 'leave' });
    removeKey(this.storageKey);
    setTimeout(() => this.shutdown(), 150);
  }

  destroy(): void {
    this.shutdown();
  }

  // ------------------------------------------------------------------

  private emit(): void {
    const snap = this.snapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  private setStatus(status: ConnStatus, text: string): void {
    this.status = status;
    this.statusText = text;
    this.emit();
  }

  private connect(): void {
    if (this.destroyed || this.rejected) return;
    this.cleanupPeer();
    this.connectStartedAt = Date.now();
    const peer = new Peer({ debug: 0 });
    this.peer = peer;
    const lost = (conn: DataConnection) => () => {
      if (this.conn === conn) this.scheduleReconnect('Mất kết nối với chủ phòng, đang kết nối lại…');
    };
    peer.on('open', () => {
      if (this.peer !== peer) return;
      const conn = peer.connect(peerIdFor(this.session.code), { reliable: true });
      this.conn = conn;
      conn.on('open', () => {
        if (this.conn !== conn) return;
        this.retry = 0;
        this.lastHostMsg = Date.now();
        const { token, name, avatar } = this.session;
        this.send({ t: 'hello', v: PROTOCOL_VERSION, token, name, avatar });
      });
      conn.on('data', (raw) => { if (this.conn === conn) this.onMessage(raw as HostMsg); });
      conn.on('close', lost(conn));
      conn.on('error', lost(conn));
    });
    peer.on('error', (err: { type?: string }) => {
      if (this.peer !== peer) return;
      if (err.type === 'peer-unavailable') {
        this.scheduleReconnect('Chủ phòng đang offline. Đang chờ chủ phòng quay lại…');
      } else if (err.type === 'browser-incompatible') {
        this.setStatus('error', 'Trình duyệt không hỗ trợ WebRTC');
      } else {
        this.scheduleReconnect('Mạng không ổn định, đang thử lại…');
      }
    });
  }

  private scheduleReconnect(text: string): void {
    if (this.destroyed || this.rejected || this.retryTimer) return;
    this.setStatus('reconnecting', text);
    const delay = Math.min(1000 * 2 ** this.retry, 8000);
    this.retry++;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  private onMessage(msg: HostMsg): void {
    if (!msg || typeof msg !== 'object') return;
    this.lastHostMsg = Date.now();
    switch (msg.t) {
      case 'welcome':
        this.seat = msg.seat;
        this.setStatus('online', '');
        break;
      case 'room':
        this.room = msg.room;
        this.emit();
        break;
      case 'view':
        this.view = msg.view;
        this.deadline = msg.deadlineIn !== null ? Date.now() + msg.deadlineIn : null;
        this.emit();
        break;
      case 'chat':
        if (!this.chatLog.some((m) => m.id === msg.msg.id)) {
          this.chatLog = [...this.chatLog, msg.msg].slice(-40);
          this.emit();
        }
        break;
      case 'error':
        this.statusText = msg.msg;
        this.emit();
        this.statusText = '';
        break;
      case 'reject':
        this.rejected = true;
        removeKey(this.storageKey);
        this.setStatus('error', msg.msg);
        this.cleanupPeer();
        break;
      case 'closed':
        this.rejected = true;
        removeKey(this.storageKey);
        this.setStatus('error', 'Chủ phòng đã đóng phòng');
        this.cleanupPeer();
        break;
      case 'pong':
        break;
    }
  }

  private tick(): void {
    if (this.destroyed || this.rejected) return;
    if (this.conn?.open) {
      this.send({ t: 'ping' });
      if (Date.now() - this.lastHostMsg > HOST_SILENT_TIMEOUT) {
        this.scheduleReconnect('Chủ phòng không phản hồi, đang kết nối lại…');
      }
    } else if (!this.retryTimer && Date.now() - this.connectStartedAt > 15000) {
      this.scheduleReconnect('Không kết nối được. Mạng có thể chặn kết nối P2P, đang thử lại…');
    }
  }

  private send(msg: GuestMsg): void {
    try {
      if (this.conn?.open) this.conn.send(msg);
    } catch {
      /* ignore */
    }
  }

  private cleanupPeer(): void {
    const { conn, peer } = this;
    this.conn = null;
    this.peer = null;
    try {
      conn?.close();
      peer?.destroy();
    } catch {
      /* ignore */
    }
  }

  private shutdown(): void {
    this.destroyed = true;
    if (this.ping) clearInterval(this.ping);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.cleanupPeer();
    this.listeners.clear();
  }
}
