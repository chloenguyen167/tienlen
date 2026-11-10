import { useState } from 'react';
import { Controller, TableSnapshot } from '../../net/controller';
import { HostController } from '../../net/host';
import { RulesEditor } from './RulesEditor';
import { ModeCards } from './ModeCards';
import { ChatSheet, useChatBubbles } from './Chat';
import { Modal, Section, toast } from './ui';
import { TEAM_COLOR } from './Seat';
import { sfx } from '../sound';

export function inviteLink(code: string): string {
  return `${location.origin}${location.pathname}#/join/${code}`;
}

export async function shareInvite(code: string) {
  const url = inviteLink(code);
  const text = `Vào chơi Tiến Lên với mình nhé! Mã phòng: ${code}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Tiến Lên', text, url });
      return;
    }
  } catch {
    /* user cancelled share sheet → fall back to copy */
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast('Đã copy link mời!', 'good');
  } catch {
    prompt('Copy link này gửi cho bạn bè:', url);
  }
}

interface Props {
  snap: TableSnapshot;
  controller: Controller;
  host: HostController | null;
  onExit: () => void;
  onLeave: () => void;
}

export function Lobby({ snap, controller, host, onExit, onLeave }: Props) {
  const room = snap.room!;
  const [rulesOpen, setRulesOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const bubbles = useChatBubbles(snap.chat, (m) => m.seat !== snap.mySeat && sfx.chat());
  const humans = room.seats.filter((s) => s.kind === 'human').length;
  const isHost = !!host;

  return (
    <div className="felt felt-texture relative min-h-dvh">
      <header className="safe-top safe-x sticky top-0 z-10 bg-felt-900/80 backdrop-blur [--sx:0px]">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pb-3">
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl" onClick={onExit} aria-label="Về trang chủ">
            ‹
          </button>
          <h1 className="flex-1 text-xl font-bold">Phòng chờ</h1>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-lg" onClick={() => setChatOpen(true)} aria-label="Trò chuyện">
            💬
          </button>
        </div>
      </header>
      <main className="safe-bottom safe-x relative mx-auto max-w-2xl [--sx:1rem] pb-8">
        {snap.status !== 'online' && snap.statusText && (
          <div className="mt-2 rounded-xl bg-amber-500/90 px-3 py-2 text-center text-sm font-semibold text-felt-900">{snap.statusText}</div>
        )}

        <Section title="Mã phòng">
          <div className="text-center font-mono text-5xl font-extrabold tracking-[0.25em] text-gold-400">{room.code}</div>
          <button className="btn-gold mt-4 w-full py-3.5" onClick={() => shareInvite(room.code)}>
            📨 Mời bạn bè
          </button>
          <p className="mt-2 text-center text-xs text-white/55">Gửi link hoặc mã phòng cho bạn bè. Ghế trống sẽ do máy chơi.</p>
        </Section>

        <Section title={`Người chơi (${humans}/4)`}>
          <div className="grid gap-2">
            {room.seats.map((s, i) => (
              <div key={i} className="relative flex items-center gap-3 rounded-2xl bg-white/5 p-2.5">
                <span
                  className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl"
                  style={room.mode === 'team' ? { boxShadow: `0 0 0 2px ${TEAM_COLOR[i % 2]}` } : undefined}
                >
                  {s.avatar}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {s.name}
                    {i === snap.mySeat && <span className="text-gold-400"> (bạn)</span>}
                  </div>
                  <div className="text-xs text-white/55">
                    {i === 0 ? 'Chủ phòng' : s.kind === 'bot' ? 'Máy' : s.connected ? 'Đã vào' : 'Mất kết nối'}
                    {room.mode === 'team' && ` · Đội ${i % 2 === 0 ? 'Xanh' : 'Cam'}`}
                  </div>
                </div>
                {bubbles[i] && <span className="max-w-[40%] truncate rounded-2xl bg-white px-2 py-1 text-xs text-felt-900">{bubbles[i]}</span>}
                {isHost && i !== 0 && s.kind === 'human' && (
                  <button className="rounded-full bg-white/10 px-3 py-1 text-xs" onClick={() => host!.kick(i)}>
                    Mời ra
                  </button>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Chế độ">
          <ModeCards
            mode={room.mode}
            disabled={!isHost}
            onChange={(m) => controller.setMode(m)}
            solo="Mỗi người một mình, máy chơi các ghế trống."
            team="Ghế 1 & 3 (Đội Xanh) đấu với ghế 2 & 4 (Đội Cam). Ai về nhất thì cả đội thắng."
          />
        </Section>

        <Section title="Luật chơi">
          <button className="btn-ghost w-full" onClick={() => setRulesOpen(true)}>
            {isHost ? '✏️ Xem & sửa luật' : '👀 Xem luật'}
          </button>
        </Section>

        <div className="mt-6 grid gap-3">
          {isHost ? (
            <button className="btn-gold py-4 text-lg" onClick={() => controller.startGame()}>
              Bắt đầu chia bài 🃏
            </button>
          ) : (
            <div className="panel p-4 text-center text-white/75">⏳ Đang chờ chủ phòng bắt đầu…</div>
          )}
          <button className="btn-ghost" onClick={onLeave}>
            {isHost ? 'Đóng phòng' : 'Rời phòng'}
          </button>
        </div>
      </main>

      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Luật chơi">
        <RulesEditor rules={room.rules} onChange={isHost ? (r) => controller.setRules(r) : undefined} readOnly={!isHost} online />
      </Modal>
      <ChatSheet open={chatOpen} onClose={() => setChatOpen(false)} messages={snap.chat} onSend={(t) => controller.chat(t)} mySeat={snap.mySeat} />
    </div>
  );
}
