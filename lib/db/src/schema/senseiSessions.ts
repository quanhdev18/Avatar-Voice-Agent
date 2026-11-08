import { createInsertSchema } from "drizzle-zod";
import { jsonb, pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const transcriptEntrySchema = z.object({
  speaker: z.enum(["teacher", "learner"]),
  text: z.string().max(5000),
  language: z.enum(["ja", "vi", "mixed"]),
  elapsedMs: z.number().int().min(0),
});

export type TranscriptEntry = z.infer<typeof transcriptEntrySchema>;

export const senseiSessionsTable = pgTable("sensei_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  lessonId: text("lesson_id").notNull(),
  roomName: text("room_name").notNull().unique(),
  status: text("status").notNull().default("active"),
  durationSeconds: integer("duration_seconds"),
  transcript: jsonb("transcript").$type<TranscriptEntry[]>().notNull().default([]),
  summary: text("summary"),
  commonMistakes: jsonb("common_mistakes").$type<string[]>().notNull().default([]),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertSenseiSessionSchema = createInsertSchema(senseiSessionsTable).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export type InsertSenseiSession = z.infer<typeof insertSenseiSessionSchema>;
export type SenseiSession = typeof senseiSessionsTable.$inferSelect;
