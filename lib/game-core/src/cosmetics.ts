/** Cosmetic options. The server only accepts values from these lists. */
export const ACCESSORIES = ['none', 'headband', 'cap', 'crown', 'ninja', 'horns', 'halo'] as const;
export const WEAPONS = ['none', 'sword', 'staff', 'hammer'] as const;
export type Accessory = (typeof ACCESSORIES)[number];
export type Weapon = (typeof WEAPONS)[number];

export const FIGHTER_COLORS = [
  { name: 'Mực', value: 'var(--ink)' },
  { name: 'Đỏ', value: 'var(--crimson)' },
  { name: 'Xanh', value: 'var(--cobalt)' },
  { name: 'Lá', value: 'var(--mint)' },
  { name: 'Tím', value: 'var(--violet)' },
  { name: 'Cam', value: '#f2802e' },
  { name: 'Hồng', value: '#e858a8' },
  { name: 'Ngọc', value: '#14a3a8' },
] as const;
export const COLOR_VALUES = FIGHTER_COLORS.map((c) => c.value) as unknown as readonly [string, ...string[]];

export type Cosmetics = { name: string; color: string; accessory: Accessory; weapon: Weapon };
