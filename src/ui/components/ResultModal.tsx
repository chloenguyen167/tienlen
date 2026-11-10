import { GameView, teamOf } from '../../core/game';
import { RoomPublic } from '../../net/protocol';
import { CardRow } from './Card';
import { Modal } from './ui';
import { PLACE_LABEL, TEAM_COLOR } from './Seat';

const MEDAL = ['🥇', '🥈', '🥉', '😵'];

interface Props {
  open: boolean;
  view: GameView;
  room: RoomPublic | null;
  canDeal: boolean;
  onDeal: () => void;
  onClose: () => void;
  onExit: () => void;
}

export function ResultModal({ open, view, room, canDeal, onDeal, onClose, onExit }: Props) {
  const r = view.result;
  if (!r) return null;
  const me = view.mySeat;
  const name = (s: number) => view.players[s]?.name ?? '';
  const won = view.mode === 'team' ? r.winnerTeam === teamOf(me) : r.ranking[0] === me;
  const myPlace = r.ranking.indexOf(me);

  let title = won ? 'Bạn thắng! 🎉' : `Bạn về ${PLACE_LABEL[myPlace].toLowerCase()}`;
  if (view.mode === 'team') title = won ? 'Đội bạn thắng! 🎉' : 'Đội bạn thua 😢';

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      {r.instantWin && (
        <div className="mb-3 rounded-2xl bg-gold-500/20 p-3 text-center font-semibold text-gold-400">
          {name(r.instantWin.seat)} tới trắng: {r.instantWin.label}!
        </div>
      )}
      <div className="space-y-2">
        {r.ranking.map((seat, place) => {
          const d = r.deltas[seat];
          const hand = view.revealedHands?.[seat] ?? [];
          const isCong = r.cong.includes(seat);
          return (
            <div key={seat} className={`rounded-2xl p-3 ${seat === me ? 'bg-white/15 ring-1 ring-gold-400/60' : 'bg-white/5'}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{view.mode === 'team' ? (teamOf(seat) === r.winnerTeam ? '🏆' : '·') : MEDAL[place]}</span>
                <span className="text-xl">{view.players[seat].avatar}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {name(seat)}
                    {seat === me && name(seat) !== 'Bạn' && ' (bạn)'}
                    {view.mode === 'team' && (
                      <span className="ml-2 rounded-full px-1.5 text-xs" style={{ background: TEAM_COLOR[teamOf(seat)], color: '#062a1f' }}>
                        Đội {teamOf(seat) === 0 ? 'Xanh' : 'Cam'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/60">
                    {isCong ? 'Cóng' : view.mode === 'solo' ? PLACE_LABEL[place] : ''}
                    {room && ` · Tổng: ${room.totals[seat] > 0 ? '+' : ''}${room.totals[seat]}`}
                  </div>
                </div>
                <span className={`text-lg font-bold ${d > 0 ? 'text-emerald-300' : d < 0 ? 'text-rose-300' : 'text-white/60'}`}>
                  {d > 0 ? `+${d}` : d}
                </span>
              </div>
              {hand.length > 0 && <CardRow cards={hand} size="xs" overlap={0.35} className="mt-2 flex-wrap" />}
            </div>
          );
        })}
      </div>
      {r.transfers.length > 0 && (
        <div className="mt-4 rounded-2xl bg-black/25 p-3 text-sm">
          <div className="mb-1 font-semibold text-gold-400">Chi tiết điểm phạt</div>
          {r.transfers.map((t, i) => (
            <div key={i} className="flex justify-between gap-2 py-0.5 text-white/80">
              <span>
                {name(t.from)} → {name(t.to)}: {t.reason}
              </span>
              <span className="font-semibold">{t.amount}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button className="btn-ghost" onClick={onExit}>
          Thoát
        </button>
        {canDeal ? (
          <button className="btn-gold" onClick={onDeal}>
            Ván mới
          </button>
        ) : (
          <button className="btn-ghost" onClick={onClose}>
            Chờ chủ phòng chia…
          </button>
        )}
      </div>
    </Modal>
  );
}
