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

export type Room = {
  id: string;
  name: string;
  host: string;
  mode: GameMode;
  map: string;
  players: number;
  max: number;
  ping: number;
  status: 'waiting' | 'playing';
  locked: boolean;
};

export const ROOMS: Room[] = [
  { id: 'A7K2', name: 'Vào là đánh, không nói nhiều', host: 'TrumQue', mode: 'team', map: 'Trang vở', players: 5, max: 8, ping: 24, status: 'waiting', locked: false },
  { id: 'B3X9', name: 'Hội người que Hà Nội', host: 'que_hn', mode: 'ffa', map: 'Sân thượng', players: 8, max: 8, ping: 31, status: 'playing', locked: false },
  { id: 'C1M4', name: 'Newbie tập chơi', host: 'MeoMeo', mode: 'team', map: 'Võ đường', players: 2, max: 6, ping: 18, status: 'waiting', locked: false },
  { id: 'D8P0', name: 'Phòng kín bạn bè', host: 'KhoaBu', mode: 'koth', map: 'Núi lửa', players: 3, max: 8, ping: 45, status: 'waiting', locked: true },
  { id: 'E5R6', name: 'Rank cao vào đây', host: 'SieuNhanQue', mode: 'ffa', map: 'Núi lửa', players: 6, max: 8, ping: 62, status: 'playing', locked: false },
  { id: 'F2T7', name: '1 vs 1 võ đường', host: 'ThayDo', mode: 'ffa', map: 'Võ đường', players: 1, max: 2, ping: 27, status: 'waiting', locked: false },
  { id: 'G9L1', name: 'Đội đỏ thiếu người', host: 'GaCon', mode: 'team', map: 'Sân thượng', players: 6, max: 8, ping: 39, status: 'waiting', locked: false },
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

export const CHAT_SEED = [
  { from: 'TrumQue', text: 'ai vào đội xanh đi', sys: false },
  { from: 'Hệ thống', text: 'MeoMeo đã vào phòng', sys: true },
  { from: 'MeoMeo', text: 'chào cả nhà 👋', sys: false },
  { from: 'KhoaBu', text: 'map trang vở ok không', sys: false },
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
