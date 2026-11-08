import {
  and,
  asc,
  db,
  eq,
  lessonProgressTable,
  lessonsTable,
  notebookItemsTable,
  type NotebookData,
  type NotebookItem,
} from "@workspace/db";

export type LessonStatus = "not_started" | "in_progress" | "completed";

export async function lessonsWithStatus(userId: string) {
  const lessons = await db.select().from(lessonsTable).orderBy(asc(lessonsTable.order));
  const progress = await db
    .select()
    .from(lessonProgressTable)
    .where(eq(lessonProgressTable.userId, userId));
  const byId = new Map(progress.map((p) => [p.lessonId, p.status]));
  return lessons.map((lesson) => ({
    ...lesson,
    status: (byId.get(lesson.id) ?? "not_started") as LessonStatus,
  }));
}

export async function getLessonWithStatus(userId: string, lessonId: string) {
  const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, lessonId));
  if (!lesson) return null;
  const [progress] = await db
    .select()
    .from(lessonProgressTable)
    .where(and(eq(lessonProgressTable.userId, userId), eq(lessonProgressTable.lessonId, lessonId)));
  return { ...lesson, status: (progress?.status ?? "not_started") as LessonStatus };
}

export async function setLessonProgress(userId: string, lessonId: string, status: LessonStatus) {
  const current = await getLessonWithStatus(userId, lessonId);
  if (!current) return null;
  // never downgrade a completed lesson
  if (current.status === "completed" && status !== "completed") return current;
  await db
    .insert(lessonProgressTable)
    .values({ userId, lessonId, status, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [lessonProgressTable.userId, lessonProgressTable.lessonId],
      set: { status, updatedAt: new Date() },
    });
  return { ...current, status };
}

export function lessonSummary(lesson: { id: string; level: string; order: number; title: string; titleVi: string; status: LessonStatus }) {
  return {
    id: lesson.id,
    level: lesson.level,
    order: lesson.order,
    title: lesson.title,
    titleVi: lesson.titleVi,
    status: lesson.status,
  };
}

export async function upsertNotebookItem(
  userId: string,
  type: "vocab" | "grammar",
  data: NotebookData,
  sourceLessonId: string | null,
): Promise<NotebookItem> {
  const term = data.term.trim();
  const [item] = await db
    .insert(notebookItemsTable)
    .values({ userId, type, term, data: { ...data, term }, sourceLessonId })
    .onConflictDoUpdate({
      target: [notebookItemsTable.userId, notebookItemsTable.type, notebookItemsTable.term],
      set: { data: { ...data, term } },
    })
    .returning();
  return item!;
}

export function serializeNotebookItem(item: NotebookItem) {
  return {
    id: item.id,
    type: item.type,
    term: item.term,
    data: item.data,
    sourceLessonId: item.sourceLessonId,
    ease: item.ease,
    intervalDays: item.intervalDays,
    repetitions: item.repetitions,
    dueAt: item.dueAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
  };
}
