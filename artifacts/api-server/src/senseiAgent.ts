import {
  AgentSession,
  AgentSessionEventTypes,
  ServerOptions,
  cli,
  defineAgent,
  llm,
  voice,
  type JobContext,
} from "@livekit/agents";
import { RoomEvent, type RemoteParticipant } from "@livekit/rtc-node";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  and,
  asc,
  db,
  eq,
  learnerProfilesTable,
  lessonsTable,
  lte,
  notebookItemsTable,
  senseiSessionsTable,
  sql,
  type TranscriptEntry,
} from "@workspace/db";
import { createAvatarProvider, createVoiceProvider } from "./agent/providers";
import { buildInstructions } from "./agent/prompt";
import { getLessonWithStatus, setLessonProgress, upsertNotebookItem } from "./lib/curriculum";
import { ensureProfile, recordStudy, summarizeSession } from "./lib/learner";
import { logger } from "./lib/logger";

type Language = "ja" | "vi" | "mixed";
type ClientAction = {
  type?: string;
  text?: string;
  slower?: boolean;
  enabled?: boolean;
  quizId?: string;
  answers?: { questionIndex: number; choiceIndex: number }[];
};
type LearnerMeta = { sessionId?: string; lessonId?: string; maxDurationSeconds?: number };

function languageFor(text: string): Language {
  const hasJapanese = /[぀-ヿ㐀-鿿]/u.test(text);
  const hasVietnamese = /[ăâđêôơưàáạảãằắặẳẵèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/iu.test(text);
  if (hasJapanese && hasVietnamese) return "mixed";
  if (hasJapanese) return "ja";
  return "vi";
}

function toText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .join("")
    .trim();
}

const boardItemSchema = z.object({
  kanji: z.string().optional().describe("Kanji or main written form; omit if the word is kana-only"),
  kana: z.string().describe("Reading in hiragana/katakana (used as furigana)"),
  romaji: z.string().describe("Hepburn romaji"),
  meaning_vi: z.string().describe("Vietnamese meaning"),
  example: z.string().optional().describe("Short Japanese example sentence"),
  example_vi: z.string().optional().describe("Vietnamese translation of the example"),
});

const quizQuestionSchema = z.object({
  question: z.string().describe("Question text (Vietnamese, may contain Japanese)"),
  options: z.array(z.string()).min(2).max(4),
  answer_index: z.number().int().min(0).max(3),
  explanation_vi: z.string().optional(),
});

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    const room = ctx.room;
    const learner: RemoteParticipant = await ctx.waitForParticipant();
    let meta: LearnerMeta = {};
    try {
      meta = JSON.parse(learner.metadata || "{}") as LearnerMeta;
    } catch {
      meta = {};
    }
    const userId = learner.identity;
    const sessionId = meta.sessionId;
    let currentLessonId = meta.lessonId ?? "n5-02-greetings";
    const maxDurationSeconds = meta.maxDurationSeconds ?? 15 * 60;
    const startedAt = Date.now();
    const transcript: TranscriptEntry[] = [];

    const publish = async (topic: string, message: Record<string, unknown>) => {
      try {
        await room.localParticipant?.publishData(new TextEncoder().encode(JSON.stringify(message)), {
          reliable: true,
          topic,
        });
      } catch (err) {
        logger.warn({ err, topic }, "publishData failed");
      }
    };
    const caption = (speaker: "teacher" | "learner", text: string) => {
      const clean = text.trim();
      if (!clean) return;
      const language = languageFor(clean);
      transcript.push({ speaker, text: clean.slice(0, 5000), language, elapsedMs: Date.now() - startedAt });
      void publish("sensei.caption", { type: "caption", speaker, text: clean, language });
    };

    // --- Load context ---------------------------------------------------
    const profile = await ensureProfile(userId).catch(() => null);
    const lesson = await getLessonWithStatus(userId, currentLessonId).catch(() => null);
    const dueItems = await db
      .select()
      .from(notebookItemsTable)
      .where(and(eq(notebookItemsTable.userId, userId), lte(notebookItemsTable.dueAt, new Date())))
      .orderBy(asc(notebookItemsTable.dueAt))
      .limit(3)
      .catch(() => []);
    const instructions = buildInstructions(
      lesson,
      profile,
      dueItems.map((i) => `${i.term} (${i.data.meaningVi})`),
    );

    // --- Tools ------------------------------------------------------------
    const tools = {
      show_on_board: llm.tool({
        description:
          "Show words or phrases on the learner's whiteboard (big kanji with furigana, romaji, Vietnamese meaning, example). Call whenever you introduce or revisit an item.",
        parameters: z.object({ items: z.array(boardItemSchema).min(1).max(6) }),
        execute: async ({ items }) => {
          await publish("sensei.board", { type: "board", items });
          return `Shown ${items.length} item(s) on the board.`;
        },
      }),
      add_to_notebook: llm.tool({
        description: "Save a vocabulary word or grammar pattern to the learner's notebook for spaced-repetition review.",
        parameters: z.object({
          type: z.enum(["vocab", "grammar"]),
          term: z.string().describe("The word (kanji/kana) or grammar pattern"),
          kana: z.string().optional(),
          romaji: z.string().optional(),
          meaning_vi: z.string(),
          example: z.string().optional(),
          example_vi: z.string().optional(),
        }),
        execute: async (data) => {
          await upsertNotebookItem(
            userId,
            data.type,
            {
              term: data.term,
              kana: data.kana,
              romaji: data.romaji,
              meaningVi: data.meaning_vi,
              example: data.example,
              exampleVi: data.example_vi,
            },
            currentLessonId,
          );
          await publish("sensei.notebook", { type: "notebook_added", term: data.term, itemType: data.type });
          return `Saved "${data.term}" to the notebook.`;
        },
      }),
      start_quiz: llm.tool({
        description:
          "Show a short multiple-choice quiz on the whiteboard. The learner's answers will arrive later as a user message starting with [QUIZ RESULT]. After calling, tell the learner to answer on screen and wait.",
        parameters: z.object({ questions: z.array(quizQuestionSchema).min(1).max(5) }),
        execute: async ({ questions }) => {
          const quizId = `quiz-${Date.now()}`;
          await publish("sensei.quiz", { type: "quiz", quizId, questions });
          return `Quiz ${quizId} is on screen. Wait for the learner's answers.`;
        },
      }),
      get_lesson: llm.tool({
        description: "Get the full content (vocab, grammar, dialogue) of a lesson by id. Ids look like n5-03-self-intro.",
        parameters: z.object({ lesson_id: z.string() }),
        execute: async ({ lesson_id }) => {
          const found = await getLessonWithStatus(userId, lesson_id);
          if (!found) {
            const all = await db.select({ id: lessonsTable.id, title: lessonsTable.titleVi }).from(lessonsTable);
            return { error: "not found", available: all };
          }
          currentLessonId = found.id;
          return { id: found.id, title: found.title, titleVi: found.titleVi, status: found.status, ...found.content };
        },
      }),
      mark_lesson_progress: llm.tool({
        description: "Update the learner's progress for a lesson.",
        parameters: z.object({
          lesson_id: z.string(),
          status: z.enum(["in_progress", "completed"]),
        }),
        execute: async ({ lesson_id, status }) => {
          const updated = await setLessonProgress(userId, lesson_id, status);
          if (updated) await publish("sensei.progress", { type: "progress", lessonId: lesson_id, status });
          return updated ? `Lesson ${lesson_id} marked ${status}.` : "Lesson not found.";
        },
      }),
      get_learner_profile: llm.tool({
        description: "Get the learner's level, weak points and the words due for review today.",
        execute: async () => {
          const p = await ensureProfile(userId);
          const due = await db
            .select()
            .from(notebookItemsTable)
            .where(and(eq(notebookItemsTable.userId, userId), lte(notebookItemsTable.dueAt, new Date())))
            .orderBy(asc(notebookItemsTable.dueAt))
            .limit(10);
          return {
            level: p.level,
            streakDays: p.streakDays,
            weakPoints: p.weakPoints,
            dueForReview: due.map((d) => ({ term: d.term, meaningVi: d.data.meaningVi, kana: d.data.kana })),
          };
        },
      }),
      record_mistake: llm.tool({
        description: "Record a pronunciation or grammar mistake the learner made (for the end-of-session report).",
        parameters: z.object({
          mistake: z.string().describe("What the learner said/did wrong"),
          correction_vi: z.string().describe("Correct form + short Vietnamese explanation"),
          weak_point: z.string().optional().describe("Short tag such as 'trợ từ は/が' or 'trường âm'"),
        }),
        execute: async ({ mistake, correction_vi, weak_point }) => {
          const line = `${mistake} → ${correction_vi}`.slice(0, 500);
          if (sessionId) {
            await db
              .update(senseiSessionsTable)
              .set({ commonMistakes: sql`${senseiSessionsTable.commonMistakes} || ${JSON.stringify([line])}::jsonb` })
              .where(and(eq(senseiSessionsTable.id, sessionId), eq(senseiSessionsTable.userId, userId)));
          }
          if (weak_point) {
            const p = await ensureProfile(userId);
            const weakPoints = [weak_point, ...p.weakPoints.filter((w) => w !== weak_point)].slice(0, 10);
            await db.update(learnerProfilesTable).set({ weakPoints }).where(eq(learnerProfilesTable.userId, userId));
          }
          return "Recorded.";
        },
      }),
    };

    // --- Session ----------------------------------------------------------
    const voiceProvider = createVoiceProvider();
    const session = new AgentSession({ llm: voiceProvider.createModel(instructions) });

    let slowerPace = false;
    let lastTeacherText = "";

    session.on(AgentSessionEventTypes.UserInputTranscribed, (event) => {
      if (event.isFinal) caption("learner", event.transcript);
    });
    session.on(AgentSessionEventTypes.ConversationItemAdded, (event) => {
      const item = event.item as { role?: string; content?: unknown };
      if (item.role !== "assistant") return;
      const text = toText(item.content);
      if (!text) return;
      lastTeacherText = text;
      caption("teacher", text);
    });
    session.on(AgentSessionEventTypes.AgentStateChanged, (event) => {
      void publish("sensei.state", { type: "agent_state", state: event.newState });
    });
    session.on(AgentSessionEventTypes.Error, (event) => {
      logger.warn({ err: event.error }, "Agent session error");
    });

    const pace = () =>
      slowerPace ? "Speak noticeably slower than usual, with clear pauses between phrases." : "";

    const reply = (opts: { userInput?: string; instructions?: string }) =>
      session
        .generateReply({ ...opts, inputModality: "text" } as Parameters<typeof session.generateReply>[0])
        .waitForPlayout()
        .catch((err: unknown) => logger.warn({ err }, "generateReply failed"));

    room.on(RoomEvent.DataReceived, (payload, participant) => {
      if (participant && participant.identity !== userId) return;
      let action: ClientAction;
      try {
        action = JSON.parse(new TextDecoder().decode(payload)) as ClientAction;
      } catch {
        return;
      }
      switch (action.type) {
        case "interruption": {
          const text = action.text?.trim().slice(0, 1000);
          if (!text) return;
          transcript.push({ speaker: "learner", text, language: languageFor(text), elapsedMs: Date.now() - startedAt });
          void (async () => {
            await session.interrupt({ force: true });
            await reply({
              userInput: `${text}\n\n(Learner typed this in chat, interrupting. Answer briefly then return to the lesson. ${pace()})`,
            });
          })();
          return;
        }
        case "raise_hand":
          void (async () => {
            await session.interrupt({ force: true });
            await reply({
              instructions: "The learner raised their hand. Stop and kindly ask in Vietnamese what they would like to ask. Keep it to one sentence.",
            });
          })();
          return;
        case "slower":
          if (typeof action.enabled === "boolean") slowerPace = action.enabled;
          if (slowerPace)
            void reply({ instructions: "The learner asked you to speak more slowly. Acknowledge in one short Vietnamese sentence and continue more slowly from now on." });
          return;
        case "repeat":
          void (async () => {
            await session.interrupt({ force: true });
            await reply({
              instructions: lastTeacherText
                ? `Repeat this last teaching point without adding anything new: "${lastTeacherText}". ${action.slower || slowerPace ? "Repeat slowly and clearly." : ""}`
                : "Repeat your most recent explanation.",
            });
          })();
          return;
        case "quiz_answer": {
          const answers = (action.answers ?? []).slice(0, 10);
          void reply({
            userInput: `[QUIZ RESULT ${action.quizId ?? ""}] ${JSON.stringify(answers)} (questionIndex/choiceIndex, 0-based). Give short feedback in Vietnamese, explain any wrong answer, then continue to the summary step.`,
          });
          return;
        }
        case "mic_unavailable":
          void reply({
            instructions: "The learner's microphone is not working, so they will type in the chat. Reassure them in one sentence and continue; ask them to type answers.",
          });
          return;
      }
    });

    // --- Time limits (avatar/voice billed per minute) ----------------------
    const warnAt = Math.max(30, maxDurationSeconds - 90) * 1000;
    const warnTimer = setTimeout(() => {
      void publish("sensei.state", { type: "time_warning", secondsLeft: 90 });
      void reply({
        instructions: "About 1 minute is left in this session. Move to a quick summary now: recap in 2-3 sentences, mark progress, and say goodbye.",
      });
    }, warnAt);
    const endTimer = setTimeout(() => {
      void publish("sensei.state", { type: "session_end", reason: "time_limit" });
      setTimeout(() => ctx.shutdown("time_limit"), 3000);
    }, maxDurationSeconds * 1000);

    // Persist transcript if the learner dropped without finishing from the UI.
    ctx.addShutdownCallback(async () => {
      clearTimeout(warnTimer);
      clearTimeout(endTimer);
      if (!sessionId) return;
      try {
        const [row] = await db.select().from(senseiSessionsTable).where(eq(senseiSessionsTable.id, sessionId));
        if (!row || row.status !== "active") return;
        const durationSeconds = Math.min(Math.floor((Date.now() - startedAt) / 1000), maxDurationSeconds + 60);
        const { summary, mistakes } = await summarizeSession(lesson?.titleVi ?? currentLessonId, transcript, row.commonMistakes);
        const [updated] = await db
          .update(senseiSessionsTable)
          .set({ status: "completed", durationSeconds, transcript: transcript.slice(-1000), summary, commonMistakes: mistakes, completedAt: new Date() })
          .where(and(eq(senseiSessionsTable.id, sessionId), eq(senseiSessionsTable.status, "active")))
          .returning({ id: senseiSessionsTable.id });
        if (updated) await recordStudy(userId, durationSeconds);
      } catch (err) {
        logger.warn({ err }, "Could not persist session on shutdown");
      }
    });

    await session.start({ room, agent: new voice.Agent({ instructions, tools }) });

    // --- Avatar (optional) with graceful fallback to voice-only -----------
    const avatar = await createAvatarProvider();
    if (avatar) {
      try {
        await avatar.start(session, room);
        void publish("sensei.avatar", { type: "avatar", status: "connected", provider: avatar.name, identity: avatar.participantIdentity });
      } catch (err) {
        logger.warn({ err }, "Avatar failed to start; continuing voice-only");
        void publish("sensei.avatar", { type: "avatar", status: "fallback", provider: avatar.name });
      }
    } else {
      void publish("sensei.avatar", { type: "avatar", status: "disabled" });
    }

    await reply({
      instructions: `Start the session now (step 1). Greet the learner warmly in Japanese with a short Vietnamese explanation, mention today's lesson "${lesson?.titleVi ?? ""}", and ${dueItems.length ? "quickly review the due words" : "ask one easy warm-up question"}.`,
    });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
