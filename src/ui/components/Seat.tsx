import { AnimatePresence, motion } from 'framer-motion';
import { GameView, teamOf } from '../../core/game';
import { SeatInfo } from '../../net/protocol';
import { CardBack } from './Card';

export const PLACE_LABEL = ['Nhất', 'Nhì', 'Ba', 'Bét'];
export const TEAM_COLOR = ['#38bdf8', '#fb923c'];

interface Props {
  seat: number;
  view: GameView | null;
  info: SeatInfo | undefined;
  name: string;
  avatar: string;
  isTurn: boolean;
  /** 0..1 of turn time left, null = no timer */
  timeLeft: number | null;
  showTeam: boolean;
  isMate: boolean;
  total: number;
  bubble?: string;
  compact?: boolean;
  waitingText?: string;
}

export function TimerRing({ fraction, size }: { fraction: number; size: number }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const color = fraction > 0.5 ? '#f5c84c' : fraction > 0.25 ? '#fb923c' : '#ef4444';
  return (
    <svg className="pointer-events-none absolute inset-0 -rotate-90" width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fraction)))}
        style={{ transition: 'stroke-dashoffset 250ms linear' }}
      />
    </svg>
  );
}

export function Avatar({ avatar, size, isTurn, timeLeft, teamColor, offline }: { avatar: string; size: number; isTurn: boolean; timeLeft: number | null; teamColor?: string; offline?: boolean }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className={`absolute inset-[3px] grid place-items-center rounded-full bg-gradient-to-b from-white/25 to-white/5 ${isTurn ? 'turn-glow' : ''} ${offline ? 'grayscale opacity-60' : ''}`}
        style={{ fontSize: size * 0.5, boxShadow: teamColor ? `0 0 0 2px ${teamColor}` : undefined }}
      >
        {avatar}
      </div>
      {isTurn && timeLeft !== null && <TimerRing fraction={timeLeft} size={size} />}
      {offline && <span className="absolute -bottom-1 -right-1 rounded-full bg-rose-600 px-1 text-[10px] font-bold">OFF</span>}
    </div>
  );
}

export function Seat({ seat, view, info, name, avatar, isTurn, timeLeft, showTeam, isMate, total, bubble, compact, waitingText }: Props) {
  const count = view?.handCounts[seat] ?? 0;
  const place = view ? view.finished.indexOf(seat) : -1;
  const cong = view?.cong.includes(seat);
  const passed = view?.phase === 'playing' && view.passed[seat] && !!view.lastPlay;
  const offline = info?.kind === 'human' && !info.connected;
  const size = compact ? 44 : 52;

  let badge: { text: string; cls: string } | null = null;
  if (place >= 0) badge = { text: PLACE_LABEL[place], cls: 'bg-gold-500 text-felt-900' };
  else if (cong) badge = { text: 'Cóng', cls: 'bg-rose-600' };
  else if (passed) badge = { text: 'Bỏ lượt', cls: 'bg-black/60 text-white/80' };

  return (
    <div className={`relative flex flex-col items-center gap-1 short:flex-row short:gap-2 ${isTurn ? '' : 'opacity-95'}`}>
      <div className="flex items-center gap-2">
        <Avatar avatar={avatar} size={size} isTurn={isTurn} timeLeft={timeLeft} teamColor={showTeam ? TEAM_COLOR[teamOf(seat)] : undefined} offline={offline} />
        {view && view.phase === 'playing' && place < 0 && !cong && (
          <div className="relative flex items-center">
            <CardBack size="xs" />
            <CardBack size="xs" className="-ml-[calc(var(--cw)*0.3)]" />
            <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-black/80 px-1 text-xs font-bold ring-1 ring-white/20">
              {count}
            </span>
          </div>
        )}
      </div>
      <div className="max-w-[7.5rem] text-center leading-tight short:ml-1 short:text-left">
        <div className="truncate text-sm font-semibold">
          {name}
          {isMate && <span className="ml-1 text-xs text-sky-300">(đồng đội)</span>}
        </div>
        <div className={`text-xs ${total >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{total > 0 ? `+${total}` : total} điểm</div>
      </div>
      {badge && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badge.cls}`}>{badge.text}</span>}
      {waitingText && <span className="max-w-[8rem] rounded-full bg-black/60 px-2 py-0.5 text-center text-[11px] text-amber-200">{waitingText}</span>}
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble}
            initial={{ opacity: 0, y: 6, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -top-9 z-20 max-w-[10rem] rounded-2xl bg-white px-3 py-1.5 text-sm font-medium text-felt-900 shadow-lg"
          >
            {bubble}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
