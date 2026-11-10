import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AVATARS } from '../net/protocol';
import { KEYS, uid } from './persistence';

export interface Stats {
  played: number;
  wins: number;
  points: number;
}

export interface ProfileState {
  id: string;
  name: string;
  avatar: string;
  stats: Stats;
  countedGames: string[];
  setName: (name: string) => void;
  setAvatar: (a: string) => void;
  recordGame: (gameId: string, won: boolean, points: number) => void;
}

export const useProfile = create<ProfileState>()(
  persist(
    (set, get) => ({
      id: uid(16),
      name: '',
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      stats: { played: 0, wins: 0, points: 0 },
      countedGames: [],
      setName: (name) => set({ name: name.slice(0, 16) }),
      setAvatar: (avatar) => set({ avatar }),
      recordGame: (gameId, won, points) => {
        const s = get();
        if (s.countedGames.includes(gameId)) return;
        set({
          stats: { played: s.stats.played + 1, wins: s.stats.wins + (won ? 1 : 0), points: s.stats.points + points },
          countedGames: [...s.countedGames, gameId].slice(-50),
        });
      },
    }),
    { name: KEYS.profile, version: 1 },
  ),
);

export const displayName = (): string => useProfile.getState().name.trim() || 'Bạn';

// zustand/persist only writes on change: save the generated id/avatar right away so they stay stable
// across reloads (the id is the player's reconnect token for online rooms).
try {
  if (!localStorage.getItem(KEYS.profile)) useProfile.setState({});
} catch {
  /* storage disabled */
}
