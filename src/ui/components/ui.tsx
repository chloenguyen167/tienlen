import { ReactNode, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose?: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`panel safe-bottom max-h-[88dvh] w-full overflow-y-auto rounded-b-none bg-felt-900/95 p-5 sm:rounded-b-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || onClose) && (
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">{title}</h2>
                {onClose && (
                  <button className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xl" onClick={onClose} aria-label="Đóng">
                    ×
                  </button>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-4 py-2.5 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-white/55">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-gold-500' : 'bg-white/20'}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, disabled }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className={`flex rounded-2xl bg-black/25 p-1 ${disabled ? 'opacity-60' : ''}`}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition ${o.value === value ? 'bg-gold-500 text-felt-900 shadow' : 'text-white/75'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="py-2">
      <div className="mb-1.5 font-medium">{label}</div>
      {children}
    </div>
  );
}

export function Page({ title, children, back = '/' }: { title: ReactNode; children: ReactNode; back?: string | null }) {
  const nav = useNavigate();
  return (
    <div className="felt felt-texture relative min-h-dvh">
      <header className="safe-top safe-x sticky top-0 z-10 bg-felt-900/80 backdrop-blur [--sx:0px]">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pb-3">
          {back !== null && (
            <button className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl" onClick={() => nav(back)} aria-label="Quay lại">
              ‹
            </button>
          )}
          <h1 className="text-xl font-bold">{title}</h1>
        </div>
      </header>
      <main className="safe-bottom safe-x relative mx-auto max-w-2xl [--sx:1rem] pb-8">{children}</main>
    </div>
  );
}

export function Section({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel mt-4 p-4">
      {title && <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gold-400">{title}</h2>}
      {children}
    </section>
  );
}

/** Re-render every `ms` while `active`. Returns Date.now(). */
export function useNow(active: boolean, ms = 250): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

let toastSeq = 0;
type ToastItem = { id: number; text: ReactNode; tone: 'info' | 'warn' | 'good' };
let pushToastImpl: ((t: ToastItem) => void) | null = null;
export function toast(text: ReactNode, tone: ToastItem['tone'] = 'info') {
  pushToastImpl?.({ id: ++toastSeq, text, tone });
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    pushToastImpl = (t) => {
      setItems((xs) => [...xs.slice(-2), t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 2600);
    };
    return () => {
      pushToastImpl = null;
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0.5rem)] z-[60] flex flex-col items-center gap-2 px-4 pt-12">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: -20, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`rounded-full px-4 py-2 text-sm font-semibold shadow-xl ${
              t.tone === 'warn' ? 'bg-rose-600 text-white' : t.tone === 'good' ? 'bg-gold-500 text-felt-900' : 'bg-black/80 text-white'
            }`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
