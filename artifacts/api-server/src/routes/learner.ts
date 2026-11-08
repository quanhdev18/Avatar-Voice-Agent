import { Router, type IRouter } from "express";
import {
  AddNotebookItemBody,
  GetDashboardResponse,
  GetLessonResponse,
  GetSessionParams,
  GetSessionResponse,
  ListLessonsResponse,
  ListNotebookResponse,
  ListSessionsResponse,
  ReviewNotebookItemBody,
  ReviewNotebookItemParams,
} from "@workspace/api-zod";
import {
  and,
  asc,
  count,
  db,
  desc,
  eq,
  lessonsTable,
  lte,
  nextDueDate,
  notebookItemsTable,
  senseiSessionsTable,
  sm2,
} from "@workspace/db";
import { requireAuth, userIdOf } from "../lib/auth";
import {
  getLessonWithStatus,
  lessonSummary,
  lessonsWithStatus,
  serializeNotebookItem,
  upsertNotebookItem,
} from "../lib/curriculum";
import { effectiveStreak, ensureProfile, secondsUsedToday } from "../lib/learner";

const router: IRouter = Router();
router.use(["/me", "/lessons", "/notebook", "/sessions"], requireAuth);

async function sessionSummaries(userId: string, limit: number) {
  const rows = await db
    .select({ session: senseiSessionsTable, lessonTitle: lessonsTable.titleVi })
    .from(senseiSessionsTable)
    .leftJoin(lessonsTable, eq(lessonsTable.id, senseiSessionsTable.lessonId))
    .where(and(eq(senseiSessionsTable.userId, userId), eq(senseiSessionsTable.status, "completed")))
    .orderBy(desc(senseiSessionsTable.startedAt))
    .limit(limit);
  return rows.map(({ session, lessonTitle }) => ({
    id: session.id,
    lessonId: session.lessonId,
    lessonTitle,
    mode: session.mode,
    status: session.status,
    durationSeconds: session.durationSeconds ?? 0,
    summary: session.summary,
    mistakeCount: session.commonMistakes.length,
    startedAt: session.startedAt.toISOString(),
  }));
}

router.get("/me/dashboard", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const profile = await ensureProfile(userId);
  const lessons = await lessonsWithStatus(userId);
  const next =
    lessons.find((l) => l.status === "in_progress") ??
    lessons.find((l) => l.status === "not_started") ??
    null;
  const [due] = await db
    .select({ n: count() })
    .from(notebookItemsTable)
    .where(and(eq(notebookItemsTable.userId, userId), lte(notebookItemsTable.dueAt, new Date())));
  const [total] = await db
    .select({ n: count() })
    .from(notebookItemsTable)
    .where(eq(notebookItemsTable.userId, userId));

  res.json(
    GetDashboardResponse.parse({
      displayName: profile.displayName,
      level: profile.level,
      streakDays: effectiveStreak(profile),
      completedLessons: lessons.filter((l) => l.status === "completed").length,
      totalLessons: lessons.length,
      nextLesson: next ? lessonSummary(next) : null,
      dueReviewCount: due?.n ?? 0,
      notebookCount: total?.n ?? 0,
      todaySecondsUsed: await secondsUsedToday(userId),
      dailyMinuteLimit: profile.dailyMinuteLimit,
      weakPoints: profile.weakPoints,
      recentSessions: await sessionSummaries(userId, 3),
    }),
  );
});

router.get("/lessons", async (_req, res): Promise<void> => {
  const lessons = await lessonsWithStatus(userIdOf(res));
  res.json(ListLessonsResponse.parse(lessons.map(lessonSummary)));
});

router.get("/lessons/:lessonId", async (req, res): Promise<void> => {
  const lesson = await getLessonWithStatus(userIdOf(res), String(req.params.lessonId));
  if (!lesson) {
    res.status(404).json({ error: "Không tìm thấy bài học." });
    return;
  }
  res.json(GetLessonResponse.parse({ ...lessonSummary(lesson), ...lesson.content }));
});

router.get("/notebook", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const dueOnly = req.query.due === "true";
  const items = await db
    .select()
    .from(notebookItemsTable)
    .where(
      dueOnly
        ? and(eq(notebookItemsTable.userId, userId), lte(notebookItemsTable.dueAt, new Date()))
        : eq(notebookItemsTable.userId, userId),
    )
    .orderBy(dueOnly ? asc(notebookItemsTable.dueAt) : desc(notebookItemsTable.createdAt))
    .limit(500);
  res.json(ListNotebookResponse.parse(items.map(serializeNotebookItem)));
});

router.post("/notebook", async (req, res): Promise<void> => {
  const body = AddNotebookItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const item = await upsertNotebookItem(
    userIdOf(res),
    body.data.type,
    body.data.data,
    body.data.sourceLessonId ?? null,
  );
  res.json(serializeNotebookItem(item));
});

router.post("/notebook/:itemId/review", async (req, res): Promise<void> => {
  const params = ReviewNotebookItemParams.safeParse(req.params);
  const body = ReviewNotebookItemBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Dữ liệu không hợp lệ." });
    return;
  }
  const where = and(
    eq(notebookItemsTable.id, params.data.itemId),
    eq(notebookItemsTable.userId, userIdOf(res)),
  );
  const [item] = await db.select().from(notebookItemsTable).where(where);
  if (!item) {
    res.status(404).json({ error: "Không tìm thấy thẻ." });
    return;
  }
  const next = sm2(item, body.data.quality);
  const now = new Date();
  const [updated] = await db
    .update(notebookItemsTable)
    .set({ ...next, dueAt: nextDueDate(next.intervalDays, now), lastReviewedAt: now })
    .where(where)
    .returning();
  res.json(serializeNotebookItem(updated!));
});

router.get("/sessions", async (_req, res): Promise<void> => {
  res.json(ListSessionsResponse.parse(await sessionSummaries(userIdOf(res), 100)));
});

router.get("/sessions/:sessionId", async (req, res): Promise<void> => {
  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ session: senseiSessionsTable, lessonTitle: lessonsTable.titleVi })
    .from(senseiSessionsTable)
    .leftJoin(lessonsTable, eq(lessonsTable.id, senseiSessionsTable.lessonId))
    .where(
      and(eq(senseiSessionsTable.id, params.data.sessionId), eq(senseiSessionsTable.userId, userIdOf(res))),
    );
  if (!row) {
    res.status(404).json({ error: "Không tìm thấy buổi học." });
    return;
  }
  const { session, lessonTitle } = row;
  res.json(
    GetSessionResponse.parse({
      id: session.id,
      lessonId: session.lessonId,
      lessonTitle,
      mode: session.mode,
      status: session.status,
      durationSeconds: session.durationSeconds ?? 0,
      summary: session.summary,
      commonMistakes: session.commonMistakes,
      transcript: session.transcript,
      startedAt: session.startedAt.toISOString(),
    }),
  );
});

export default router;
