/** All browser storage used by the game lives under this prefix. */
export const PREFIX = 'tienlen:';

export const KEYS = {
  settings: `${PREFIX}settings`,
  profile: `${PREFIX}profile`,
  local: `${PREFIX}local`,
  host: `${PREFIX}host`,
  guest: `${PREFIX}guest`,
} as const;

export function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or disabled – game keeps working in memory */
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Remove saved games only (keeps profile + settings). */
export function clearSavedGames(): void {
  [KEYS.local, KEYS.host, KEYS.guest].forEach(removeKey);
}

/** Remove everything this game stored in the browser. */
export function clearAllData(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
}

export const uid = (len = 12): string => {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => (b % 36).toString(36)).join('');
};
