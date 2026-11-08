/**
 * SM-2 spaced repetition.
 * quality: 0..5 (0-2 = forgot, 3 = hard, 4 = good, 5 = easy)
 */
export type SrsState = { ease: number; intervalDays: number; repetitions: number };

export function sm2(state: SrsState, quality: number): SrsState {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { ease, intervalDays, repetitions } = state;
  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * ease);
  }
  ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ease < 1.3) ease = 1.3;
  return { ease: Math.round(ease * 100) / 100, intervalDays, repetitions };
}

export function nextDueDate(intervalDays: number, from = new Date()): Date {
  return new Date(from.getTime() + intervalDays * 24 * 60 * 60 * 1000);
}
