import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useProfile } from '../../store/profileStore';
import { savedGuest, savedHost, savedLocal } from '../../net/session';
import { CardFace } from '../components/Card';
import { Modal } from '../components/ui';
import { ProfileEditor } from '../components/ProfileEditor';
import { makeCard } from '../../core/cards';

const HERO = [makeCard(15, 3), makeCard(14, 0), makeCard(13, 2), makeCard(12, 1), makeCard(3, 0)];

export function Home() {
  const nav = useNavigate();
  const profile = useProfile();
  const [editProfile, setEditProfile] = useState(false);
  const [askLocal, setAskLocal] = useState(false);
  const local = savedLocal();
  const host = savedHost();
  const guest = savedGuest();
  const localInProgress = !!local?.game && local.game.phase === 'playing';

  const resumeItems = [
    local?.game && { key: 'local', icon: '🤖', title: 'Ván với máy', sub: localInProgress ? 'Đang chơi dở' : `${local.gamesPlayed} ván đã chơi`, to: '/play' },
    host && { key: 'host', icon: '👑', title: `Phòng ${host.code}`, sub: 'Bạn là chủ phòng', to: `/room/${host.code}` },
    guest && guest.code !== host?.code && { key: 'guest', icon: '🎴', title: `Phòng ${guest.code}`, sub: 'Vào lại phòng của bạn bè', to: `/room/${guest.code}` },
  ].filter(Boolean) as { key: string; icon: string; title: string; sub: string; to: string }[];

  return (
    <div className="felt felt-texture relative min-h-dvh overflow-x-hidden">
      <div className="safe-top safe-bottom safe-x relative mx-auto flex min-h-dvh max-w-md flex-col [--sx:1.25rem]">
        <div className="flex items-center justify-between pt-2">
          <button className="flex items-center gap-2 rounded-full bg-black/25 py-1.5 pl-1.5 pr-4" onClick={() => setEditProfile(true)}>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-xl">{profile.avatar}</span>
            <span className="max-w-[9rem] truncate font-semibold">{profile.name || 'Đặt tên'}</span>
          </button>
          <Link to="/settings" className="grid h-11 w-11 place-items-center rounded-full bg-black/25 text-xl" aria-label="Cài đặt">
            ⚙️
          </Link>
        </div>

        <div className="relative mt-6 flex h-36 items-end justify-center">
          {HERO.map((c, i) => (
            <motion.div
              key={c}
              className="absolute bottom-0 origin-bottom"
              initial={{ rotate: 0, y: 40, opacity: 0 }}
              animate={{ rotate: (i - 2) * 12, y: Math.abs(i - 2) * 8, opacity: 1 }}
              transition={{ delay: i * 0.08, type: 'spring', damping: 14 }}
            >
              <CardFace card={c} size="lg" />
            </motion.div>
          ))}
        </div>
        <h1 className="mt-4 text-center text-4xl font-extrabold tracking-tight">
          Tiến Lên <span className="text-gold-400">Miền Nam</span>
        </h1>
        <p className="mt-1 text-center text-sm text-white/65">Chơi với máy hoặc mời bạn bè · Không cần đăng ký</p>

        {resumeItems.length > 0 && (
          <div className="mt-6 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide text-gold-400">Chơi tiếp</div>
            {resumeItems.map((r) => (
              <button key={r.key} onClick={() => nav(r.to)} className="flex w-full items-center gap-3 rounded-2xl bg-gold-500/15 p-3 text-left ring-1 ring-gold-400/40 active:scale-[.98]">
                <span className="text-2xl">{r.icon}</span>
                <span className="flex-1">
                  <span className="block font-semibold">{r.title}</span>
                  <span className="block text-xs text-white/65">{r.sub}</span>
                </span>
                <span className="text-gold-400">▶</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 grid gap-3">
          <button className="btn-gold py-4 text-lg" onClick={() => (localInProgress ? setAskLocal(true) : nav('/play/new'))}>
            🤖 Chơi với máy
          </button>
          <button className="btn-ghost py-4 text-lg" onClick={() => nav('/create')}>
            👥 Tạo phòng mời bạn
          </button>
          <button className="btn-ghost py-4 text-lg" onClick={() => nav('/join')}>
            🔑 Vào phòng bằng mã
          </button>
          <Link to="/guide" className="btn-ghost py-3">
            📖 Hướng dẫn &amp; luật chơi
          </Link>
        </div>

        <div className="mt-auto pt-8 text-center text-xs text-white/45">
          Đã chơi {profile.stats.played} ván · Thắng {profile.stats.wins} · Điểm {profile.stats.points > 0 ? '+' : ''}
          {profile.stats.points}
        </div>
      </div>

      <Modal open={editProfile} onClose={() => setEditProfile(false)} title="Hồ sơ của bạn">
        <ProfileEditor />
        <button className="btn-gold mt-5 w-full" onClick={() => setEditProfile(false)}>
          Xong
        </button>
      </Modal>

      <Modal open={askLocal} onClose={() => setAskLocal(false)} title="Bạn có ván đang chơi dở">
        <div className="grid gap-3">
          <button className="btn-gold" onClick={() => nav('/play')}>
            ▶ Chơi tiếp ván cũ
          </button>
          <button className="btn-ghost" onClick={() => nav('/play/new')}>
            Bắt đầu ván mới
          </button>
        </div>
      </Modal>
    </div>
  );
}
