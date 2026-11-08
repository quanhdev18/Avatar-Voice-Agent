import type { Accessory, Weapon } from '@/components/StickFigure';

export type GameMode = 'team' | 'ffa' | 'koth';
export const MODE_LABEL: Record<GameMode, string> = {
  team: 'Đồng đội',
  ffa: 'Hỗn chiến',
  koth: 'Giữ đồi',
};

export const MAPS = [
  { id: 'notebook', name: 'Trang vở', desc: 'Ba bục gỗ, không bẫy', color: 'var(--cobalt)' },
  { id: 'rooftop', name: 'Sân thượng', desc: 'Gió đẩy người theo nhịp', color: 'var(--crimson)' },
  { id: 'volcano', name: 'Núi lửa', desc: 'Dung nham dâng theo thời gian', color: '#f2802e' },
  { id: 'dojo', name: 'Võ đường', desc: 'Sàn phẳng, đấu tay đôi', color: 'var(--mint)' },
];

export type Bot = { name: string; color: string; accessory: Accessory; weapon: Weapon };

export const BOTS: Bot[] = [
  { name: 'TrumQue', color: 'var(--crimson)', accessory: 'crown', weapon: 'sword' },
  { name: 'MeoMeo', color: '#e858a8', accessory: 'halo', weapon: 'none' },
  { name: 'KhoaBu', color: 'var(--cobalt)', accessory: 'cap', weapon: 'staff' },
  { name: 'SieuNhanQue', color: 'var(--violet)', accessory: 'horns', weapon: 'hammer' },
  { name: 'ThayDo', color: 'var(--mint)', accessory: 'ninja', weapon: 'none' },
  { name: 'GaCon', color: '#f2802e', accessory: 'none', weapon: 'sword' },
  { name: 'que_hn', color: '#14a3a8', accessory: 'headband', weapon: 'staff' },
];

export const ACCESSORY_LABEL: Record<Accessory, string> = {
  none: 'Không',
  headband: 'Băng đô',
  cap: 'Mũ lưỡi trai',
  crown: 'Vương miện',
  ninja: 'Khăn ninja',
  horns: 'Sừng quỷ',
  halo: 'Hào quang',
};

export const WEAPON_LABEL: Record<Weapon, string> = {
  none: 'Tay không',
  sword: 'Kiếm',
  staff: 'Gậy',
  hammer: 'Búa',
};

export const WEAPON_STATS: Record<Weapon, { dmg: number; speed: number; reach: number }> = {
  none: { dmg: 2, speed: 5, reach: 2 },
  sword: { dmg: 4, speed: 4, reach: 3 },
  staff: { dmg: 3, speed: 3, reach: 5 },
  hammer: { dmg: 5, speed: 2, reach: 3 },
};
