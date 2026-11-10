import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_RULES, RuleSettings } from '../core/settings';
import { KEYS } from './persistence';

export type BotSpeed = 'slow' | 'normal' | 'fast';

export interface SettingsState {
  sound: boolean;
  vibrate: boolean;
  botSpeed: BotSpeed;
  /** default rules for new games / rooms */
  rules: RuleSettings;
  set: (patch: Partial<Omit<SettingsState, 'set' | 'setRules' | 'resetRules'>>) => void;
  setRules: (patch: Partial<RuleSettings>) => void;
  resetRules: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      sound: true,
      vibrate: true,
      botSpeed: 'normal',
      rules: DEFAULT_RULES,
      set: (patch) => set(patch),
      setRules: (patch) => set((s) => ({ rules: { ...s.rules, ...patch } })),
      resetRules: () => set({ rules: DEFAULT_RULES }),
    }),
    {
      name: KEYS.settings,
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return { ...current, ...p, rules: { ...DEFAULT_RULES, ...(p.rules ?? {}) } };
      },
    },
  ),
);

const DELAYS: Record<BotSpeed, number> = { slow: 1500, normal: 950, fast: 450 };
export const botDelay = (): number => {
  const base = DELAYS[useSettings.getState().botSpeed];
  return base * (0.75 + Math.random() * 0.5);
};
