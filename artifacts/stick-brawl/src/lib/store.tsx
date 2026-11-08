import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Accessory, Weapon } from '@/components/StickFigure';
import { readStorage, writeStorage } from '@/lib/utils';

export { FIGHTER_COLORS } from '@workspace/game-core';

export type Profile = {
  name: string;
  color: string;
  accessory: Accessory;
  weapon: Weapon;
  level: number;
  xp: number;
  coins: number;
};

export type Settings = {
  theme: 'paper' | 'chalk';
  music: number;
  sfx: number;
  shake: boolean;
  damageNumbers: boolean;
  quality: 'low' | 'mid' | 'high';
};

const DEFAULT_PROFILE: Profile = {
  name: 'NguoiQue_' + Math.floor(100 + Math.random() * 900),
  color: 'var(--ink)',
  accessory: 'headband',
  weapon: 'none',
  level: 7,
  xp: 640,
  coins: 1250,
};

const DEFAULT_SETTINGS: Settings = {
  theme: 'paper',
  music: 60,
  sfx: 80,
  shake: true,
  damageNumbers: true,
  quality: 'high',
};

type Ctx = {
  profile: Profile;
  setProfile: (p: Partial<Profile>) => void;
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
};

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [profile, setP] = useState<Profile>(() => readStorage('qc.profile', DEFAULT_PROFILE));
  const [settings, setS] = useState<Settings>(() => readStorage('qc.settings', DEFAULT_SETTINGS));

  useEffect(() => writeStorage('qc.profile', profile), [profile]);
  useEffect(() => {
    writeStorage('qc.settings', settings);
    document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  const setProfile = useCallback((p: Partial<Profile>) => setP((o) => ({ ...o, ...p })), []);
  const setSettings = useCallback((s: Partial<Settings>) => setS((o) => ({ ...o, ...s })), []);

  return <StoreCtx.Provider value={{ profile, setProfile, settings, setSettings }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

/* Result of the last match (local or online), handed from Play to Results. */
export type MatchResult = {
  mode: 'team' | 'ffa';
  /** team id in team mode, player id in free-for-all, or 'draw' */
  winner: string;
  score: Record<string, number>;
  durationSec: number;
  /** set for online matches: the room to go back to */
  roomId?: string;
  players: {
    id: string;
    name: string;
    team: string;
    color: string;
    accessory: Accessory;
    weapon: Weapon;
    kos: number;
    falls: number;
    damage: number;
    you?: boolean;
  }[];
};

let lastResult: MatchResult | null = null;
export const setLastResult = (r: MatchResult) => {
  lastResult = r;
};
export const getLastResult = () => lastResult;
