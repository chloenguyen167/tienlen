import { GameMode } from '../../core/game';

export function ModeCards({ mode, onChange, solo, team, disabled }: { mode: GameMode; onChange: (m: GameMode) => void; solo: string; team: string; disabled?: boolean }) {
  const item = (m: GameMode, icon: string, title: string, desc: string) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(m)}
      className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${mode === m ? 'bg-gold-500/20 ring-2 ring-gold-400' : 'bg-white/5 ring-1 ring-white/10'} ${disabled ? 'opacity-70' : 'active:scale-[.98]'}`}
    >
      <span className="text-2xl">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-white/65">{desc}</span>
      </span>
    </button>
  );
  return (
    <div className="grid gap-2">
      {item('solo', '🃏', 'Đánh đơn', solo)}
      {item('team', '🤝', 'Đánh đội (2 vs 2)', team)}
    </div>
  );
}
