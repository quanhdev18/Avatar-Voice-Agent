import {
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  index,
  uuid,
} from "drizzle-orm/pg-core";
import type { LessonContent } from "../curriculum/types";

/** JLPT lessons. Content is seeded from `src/curriculum/n5.ts`. */
export const lessonsTable = pgTable("lessons", {
  id: text("id").primaryKey(),
  level: text("level").notNull(),
  order: integer("order").notNull(),
  title: text("title").notNull(),
  titleVi: text("title_vi").notNull(),
  content: jsonb("content").$type<LessonContent>().notNull(),
});

export const learnerProfilesTable = pgTable("learner_profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name"),
  level: text("level").notNull().default("N5"),
  streakDays: integer("streak_days").notNull().default(0),
  lastStudyDate: date("last_study_date"),
  weakPoints: jsonb("weak_points").$type<string[]>().notNull().default([]),
  dailyMinuteLimit: integer("daily_minute_limit").notNull().default(30),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lessonProgressTable = pgTable(
  "lesson_progress",
  {
    userId: text("user_id").notNull(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessonsTable.id),
    status: text("status").$type<"not_started" | "in_progress" | "completed">().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

export type NotebookData = {
  term: string;
  kana?: string;
  romaji?: string;
  meaningVi: string;
  example?: string;
  exampleVi?: string;
};

export const notebookItemsTable = pgTable(
  "notebook_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").$type<"vocab" | "grammar">().notNull(),
    term: text("term").notNull(),
    data: jsonb("data").$type<NotebookData>().notNull(),
    sourceLessonId: text("source_lesson_id"),
    // SM-2 fields
    ease: real("ease").notNull().default(2.5),
    intervalDays: integer("interval_days").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notebook_user_type_term").on(t.userId, t.type, t.term),
    index("notebook_user_due").on(t.userId, t.dueAt),
  ],
);

/** Minutes used per user per day (avatar/voice providers bill per minute). */
export const usageDailyTable = pgTable(
  "usage_daily",
  {
    userId: text("user_id").notNull(),
    day: date("day").notNull(),
    seconds: integer("seconds").notNull().default(0),
    sessions: integer("sessions").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

export type Lesson = typeof lessonsTable.$inferSelect;
export type LearnerProfile = typeof learnerProfilesTable.$inferSelect;
export type NotebookItem = typeof notebookItemsTable.$inferSelect;
