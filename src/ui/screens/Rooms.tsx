import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GameMode } from '../../core/game';
import { createHostRoom, getController, leaveCurrent, openRoom, useTable, currentTableKey } from '../../net/session';
import { normalizeCode } from '../../net/protocol';
import { HostController } from '../../net/host';
import { useSettings } from '../../store/settingsStore';
import { useProfile } from '../../store/profileStore';
import { GameTable } from '../components/GameTable';
import { RulesEditor } from '../components/RulesEditor';
import { Page, Section } from '../components/ui';
import { ModeCards } from '../components/ModeCards';
import { ProfileEditor } from '../components/ProfileEditor';
import { Lobby } from '../components/Lobby';
import { Loading } from './LocalPlay';

/** /create */
export function CreateRoom() {
  const nav = useNavigate();
  const settings = useSettings();
  const name = useProfile((s) => s.name);
  const [mode, setMode] = useState<GameMode>('solo');
  const [rules, setRules] = useState(settings.rules);
  return (
    <Page title="Tạo phòng">
      <Section title="Bạn là">
        <ProfileEditor />
      </Section>
      <Section title="Chế độ">
        <ModeCards
          mode={mode}
          onChange={setMode}
          solo="Bạn và bạn bè mỗi người một mình, ghế trống do máy chơi."
          team="Bạn và 1 người bạn ngồi đối diện là đồng đội, đấu với 2 máy."
        />
      </Section>
      <Section>
        <details>
          <summary className="cursor-pointer font-semibold text-gold-400">Tuỳ chỉnh luật</summary>
          <RulesEditor rules={rules} onChange={setRules} online />
        </details>
      </Section>
      <button
        className="btn-gold mt-6 w-full py-4 text-lg"
        disabled={!name.trim()}
        onClick={() => {
          const code = createHostRoom(mode, rules);
          nav(`/room/${code}`, { replace: true });
        }}
      >
        {name.trim() ? 'Tạo phòng' : 'Nhập tên để tạo phòng'}
      </button>
      <p className="mt-3 text-center text-xs text-white/50">
        Phòng chạy trực tiếp trên trình duyệt của bạn (P2P). Giữ trang này mở trong lúc chơi; nếu thoát ra, mở lại để mọi người tiếp tục.
      </p>
    </Page>
  );
}

/** /join and /join/:code */
export function JoinRoom() {
  const nav = useNavigate();
  const params = useParams();
  const name = useProfile((s) => s.name);
  const [code, setCode] = useState(normalizeCode(params.code ?? ''));
  const ok = code.length === 6 && name.trim().length > 0;
  return (
    <Page title="Vào phòng">
      <Section title="Mã phòng">
        <input
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          placeholder="VD: K7M2QX"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          className="w-full rounded-2xl bg-black/30 px-4 py-4 text-center font-mono text-3xl tracking-[0.3em] uppercase outline-none ring-1 ring-white/15 focus:ring-gold-400"
        />
      </Section>
      <Section title="Bạn là">
        <ProfileEditor />
      </Section>
      <button className="btn-gold mt-6 w-full py-4 text-lg" disabled={!ok} onClick={() => nav(`/room/${code}`, { replace: true })}>
        {!name.trim() ? 'Nhập tên để vào phòng' : 'Vào phòng'}
      </button>
    </Page>
  );
}

/** /room/:code – lobby or table, as host or guest. */
export function Room() {
  const nav = useNavigate();
  const code = normalizeCode(useParams().code ?? '');
  const name = useProfile((s) => s.name);
  const snap = useTable((s) => s.snap);
  const [ready, setReady] = useState(() => !!name.trim());

  useEffect(() => {
    if (code.length === 6 && ready) openRoom(code);
  }, [code, ready]);

  if (code.length !== 6) return <Page title="Không tìm thấy phòng"><p className="mt-6">Mã phòng không hợp lệ.</p></Page>;
  if (!ready) {
    return (
      <Page title={`Vào phòng ${code}`}>
        <Section title="Bạn là">
          <ProfileEditor />
        </Section>
        <button className="btn-gold mt-6 w-full py-4 text-lg" disabled={!name.trim()} onClick={() => setReady(true)}>
          {name.trim() ? 'Vào phòng' : 'Nhập tên để vào phòng'}
        </button>
      </Page>
    );
  }

  const c = getController();
  if (!snap || !c || currentTableKey() !== `room:${code}`) return <Loading text="Đang vào phòng…" />;

  const leave = () => {
    leaveCurrent();
    nav('/');
  };

  if (snap.status === 'error' && !snap.view) {
    return (
      <Page title={`Phòng ${code}`}>
        <div className="panel mt-6 p-6 text-center">
          <div className="text-4xl">😕</div>
          <p className="mt-3 font-semibold">{snap.statusText || 'Không vào được phòng'}</p>
          <button className="btn-gold mt-6 w-full" onClick={leave}>
            Về trang chủ
          </button>
        </div>
      </Page>
    );
  }

  if (!snap.room || !snap.view) {
    if (!snap.room) return <Loading text={snap.statusText || 'Đang kết nối tới phòng…'} />;
    return <Lobby snap={snap} controller={c} host={c instanceof HostController ? c : null} onExit={() => nav('/')} onLeave={leave} />;
  }
  return <GameTable snap={snap} controller={c} onExit={() => nav('/')} onLeave={leave} />;
}
