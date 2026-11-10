import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { GameMode } from '../../core/game';
import { getController, leaveCurrent, resumeLocal, startLocal, useTable, currentTableKey, savedLocal } from '../../net/session';
import { useSettings } from '../../store/settingsStore';
import { GameTable } from '../components/GameTable';
import { RulesEditor } from '../components/RulesEditor';
import { Page, Section, Segmented } from '../components/ui';
import { ModeCards } from '../components/ModeCards';

/** /play – resume the saved offline game. */
export function LocalPlay() {
  const nav = useNavigate();
  const snap = useTable((s) => s.snap);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (currentTableKey() !== 'local' && !resumeLocal()) setMissing(true);
  }, []);
  useEffect(() => {
    if (snap && !snap.view && currentTableKey() === 'local') getController()?.startGame();
  }, [snap]);

  if (missing) return <Navigate to="/play/new" replace />;
  const c = getController();
  if (!snap || !c || currentTableKey() !== 'local') return <Loading />;
  if (!snap.view) return <Loading />;
  return (
    <GameTable
      snap={snap}
      controller={c}
      onExit={() => nav('/')}
      onLeave={() => {
        leaveCurrent();
        nav('/');
      }}
    />
  );
}

/** /play/new – choose mode & rules, then deal. */
export function LocalSetup() {
  const nav = useNavigate();
  const settings = useSettings();
  const [mode, setMode] = useState<GameMode>(savedLocal()?.mode ?? 'solo');
  const [rules, setRules] = useState(settings.rules);
  return (
    <Page title="Chơi với máy">
      <Section title="Chế độ">
        <ModeCards
          mode={mode}
          onChange={setMode}
          solo="Bạn đấu với 3 máy, mỗi người một mình."
          team="Bạn và máy ngồi đối diện là đồng đội, đấu với 2 máy còn lại."
        />
      </Section>
      <Section title="Độ khó">
        <Segmented
          value={rules.botLevel}
          onChange={(botLevel) => setRules({ ...rules, botLevel })}
          options={[
            { value: 'easy', label: 'Dễ' },
            { value: 'medium', label: 'Trung bình' },
            { value: 'hard', label: 'Khó' },
          ]}
        />
      </Section>
      <Section>
        <details>
          <summary className="cursor-pointer font-semibold text-gold-400">Tuỳ chỉnh luật</summary>
          <RulesEditor rules={rules} onChange={setRules} />
        </details>
      </Section>
      <button
        className="btn-gold mt-6 w-full py-4 text-lg"
        onClick={() => {
          startLocal(mode, rules);
          nav('/play', { replace: true });
        }}
      >
        Chia bài 🃏
      </button>
    </Page>
  );
}

export function Loading({ text = 'Đang tải…' }: { text?: string }) {
  return (
    <div className="felt grid h-dvh place-items-center">
      <div className="flex flex-col items-center gap-3 text-white/80">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-gold-400" />
        {text}
      </div>
    </div>
  );
}
