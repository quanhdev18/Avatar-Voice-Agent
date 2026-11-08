import {
  and,
  db,
  eq,
  learnerProfilesTable,
  lessonsTable,
  N5_LESSONS,
  sql,
  usageDailyTable,
  type TranscriptEntry,
} from "@workspace/db";
import { config } from "./config";
import { logger } from "./logger";

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Upsert the seeded curriculum. Idempotent; safe on every boot. */
export async function seedCurriculum(): Promise<void> {
  for (const lesson of N5_LESSONS) {
    await db
      .insert(lessonsTable)
      .values(lesson)
      .onConflictDoUpdate({
        target: lessonsTable.id,
        set: { title: lesson.title, titleVi: lesson.titleVi, order: lesson.order, content: lesson.content },
      });
  }
  logger.info({ lessons: N5_LESSONS.length }, "Curriculum seeded");
}

export async function ensureProfile(userId: string) {
  const [existing] = await db
    .select()
    .from(learnerProfilesTable)
    .where(eq(learnerProfilesTable.userId, userId));
  if (existing) return existing;
  const [created] = await db
    .insert(learnerProfilesTable)
    .values({ userId, dailyMinuteLimit: config.defaultDailyMinutes })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db.select().from(learnerProfilesTable).where(eq(learnerProfilesTable.userId, userId));
  return again!;
}

export async function secondsUsedToday(userId: string): Promise<number> {
  const [row] = await db
    .select()
    .from(usageDailyTable)
    .where(and(eq(usageDailyTable.userId, userId), eq(usageDailyTable.day, today())));
  return row?.seconds ?? 0;
}

/** Log billed minutes and maintain the daily streak. */
export async function recordStudy(userId: string, seconds: number): Promise<void> {
  const day = today();
  await db
    .insert(usageDailyTable)
    .values({ userId, day, seconds, sessions: 1 })
    .onConflictDoUpdate({
      target: [usageDailyTable.userId, usageDailyTable.day],
      set: {
        seconds: sql`${usageDailyTable.seconds} + ${seconds}`,
        sessions: sql`${usageDailyTable.sessions} + 1`,
      },
    });

  const profile = await ensureProfile(userId);
  if (profile.lastStudyDate === day) return;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const streak = profile.lastStudyDate === yesterday ? profile.streakDays + 1 : 1;
  await db
    .update(learnerProfilesTable)
    .set({ streakDays: streak, lastStudyDate: day })
    .where(eq(learnerProfilesTable.userId, userId));
}

/** Displayed streak resets if the learner skipped yesterday. */
export function effectiveStreak(profile: { streakDays: number; lastStudyDate: string | null }): number {
  if (!profile.lastStudyDate) return 0;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  return profile.lastStudyDate === today() || profile.lastStudyDate === yesterday ? profile.streakDays : 0;
}

/**
 * Summarise a session. Uses Gemini (text) when GOOGLE_API_KEY is set; otherwise
 * a deterministic fallback so the history page always has something useful.
 */
export async function summarizeSession(
  lessonTitle: string,
  transcript: TranscriptEntry[],
  knownMistakes: string[],
): Promise<{ summary: string; mistakes: string[] }> {
  const fallback = () => {
    const learnerTurns = transcript.filter((t) => t.speaker === "learner").length;
    const japanese = transcript.filter((t) => t.language !== "vi").length;
    return {
      summary: `Buổi học "${lessonTitle}": ${transcript.length} lượt hội thoại, bạn đã nói/hỏi ${learnerTurns} lần, ${japanese} câu có tiếng Nhật.`,
      mistakes: knownMistakes,
    };
  };
  if (!process.env.GOOGLE_API_KEY || transcript.length === 0) return fallback();

  const text = transcript
    .slice(-200)
    .map((t) => `${t.speaker === "teacher" ? "Sensei" : "Học viên"}: ${t.text}`)
    .join("\n");
  const prompt = `Bạn là trợ lý của giáo viên tiếng Nhật. Dựa vào transcript buổi học "${lessonTitle}" dưới đây, trả về JSON {"summary": string (3-4 câu tiếng Việt, nêu nội dung đã học và tiến bộ), "mistakes": string[] (tối đa 6 lỗi phát âm/ngữ pháp học viên mắc, mỗi lỗi kèm cách sửa, tiếng Việt)}.\n\n${text}`;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_SUMMARY_MODEL ?? "gemini-2.5-flash"}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": process.env.GOOGLE_API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) throw new Error(`Gemini ${response.status}`);
    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(raw) as { summary?: unknown; mistakes?: unknown };
    const mistakes = Array.isArray(parsed.mistakes)
      ? parsed.mistakes.filter((m): m is string => typeof m === "string").slice(0, 10)
      : [];
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 5000) : fallback().summary,
      mistakes: [...new Set([...knownMistakes, ...mistakes])].slice(0, 50),
    };
  } catch (err) {
    logger.warn({ err }, "Session summary generation failed, using fallback");
    return fallback();
  }
}
