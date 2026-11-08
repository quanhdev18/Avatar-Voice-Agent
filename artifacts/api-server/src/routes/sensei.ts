import { AccessToken } from "livekit-server-sdk";
import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  FinishVoiceSessionBody,
  FinishVoiceSessionParams,
  FinishVoiceSessionResponse,
  GetVoiceStatusResponse,
  StartVoiceSessionBody,
  StartVoiceSessionResponse,
} from "@workspace/api-zod";
import { and, db, eq, lessonsTable, senseiSessionsTable } from "@workspace/db";
import { requireAuth, userIdOf } from "../lib/auth";
import {
  authMode,
  avatarConfigured,
  config,
  missingVoiceProviders,
} from "../lib/config";
import { setLessonProgress } from "../lib/curriculum";
import { ensureProfile, recordStudy, secondsUsedToday, summarizeSession } from "../lib/learner";

const router: IRouter = Router();

router.get("/sensei/voice-status", (_req, res): void => {
  const missingProviders = missingVoiceProviders();
  const avatar = avatarConfigured();
  res.json(
    GetVoiceStatusResponse.parse({
      available: missingProviders.length === 0,
      missingProviders,
      voiceProvider: config.voiceProvider,
      avatarProvider: avatar === "none" ? null : avatar,
      authMode: authMode(),
    }),
  );
});

router.post("/sensei/sessions", requireAuth, async (req, res): Promise<void> => {
  const body = StartVoiceSessionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const userId = userIdOf(res);
  const mode = body.data.mode ?? "voice";

  const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, body.data.lessonId));
  if (!lesson) {
    res.status(404).json({ error: "Không tìm thấy bài học." });
    return;
  }

  const missingProviders = missingVoiceProviders();
  if (mode === "voice" && missingProviders.length > 0) {
    res.status(503).json({ error: "Voice providers are not configured.", missingProviders });
    return;
  }

  // Per-day minute budget (avatar + realtime voice are billed per minute).
  const profile = await ensureProfile(userId);
  const remainingDailySeconds = Math.max(0, profile.dailyMinuteLimit * 60 - (await secondsUsedToday(userId)));
  if (remainingDailySeconds < 30) {
    res.status(429).json({
      error: `Bạn đã dùng hết ${profile.dailyMinuteLimit} phút học hôm nay. Hẹn gặp lại ngày mai!`,
    });
    return;
  }
  const maxDurationSeconds = Math.min(config.maxSessionSeconds, remainingDailySeconds);

  const roomName = `sensei-${randomUUID()}`;
  const avatar = mode === "voice" ? avatarConfigured() : "none";
  const [session] = await db
    .insert(senseiSessionsTable)
    .values({
      userId,
      lessonId: lesson.id,
      roomName,
      mode,
      avatarProvider: avatar === "none" ? null : avatar,
      status: "active",
      transcript: [],
      commonMistakes: [],
    })
    .returning({ id: senseiSessionsTable.id });
  await setLessonProgress(userId, lesson.id, "in_progress");

  let livekitUrl: string | null = null;
  let participantToken: string | null = null;
  const tokenTtl = maxDurationSeconds + 120;
  if (mode === "voice") {
    const accessToken = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
      identity: userId,
      ttl: `${tokenTtl}s`,
      name: profile.displayName ?? "Learner",
      // The agent reads this to know which lesson/session it is teaching.
      metadata: JSON.stringify({ sessionId: session!.id, lessonId: lesson.id, maxDurationSeconds }),
    });
    accessToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    participantToken = await accessToken.toJwt();
    livekitUrl = process.env.LIVEKIT_URL!;
  }

  res.status(201).json(
    StartVoiceSessionResponse.parse({
      sessionId: session!.id,
      roomName,
      mode,
      livekitUrl,
      participantToken,
      tokenExpiresAt: new Date(Date.now() + tokenTtl * 1000).toISOString(),
      maxDurationSeconds,
      remainingDailySeconds,
      avatarProvider: avatar === "none" ? null : avatar,
    }),
  );
});

router.post("/sensei/sessions/:sessionId/finish", requireAuth, async (req, res): Promise<void> => {
  const params = FinishVoiceSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = FinishVoiceSessionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const userId = userIdOf(res);
  const where = and(eq(senseiSessionsTable.id, params.data.sessionId), eq(senseiSessionsTable.userId, userId));
  const [existing] = await db.select().from(senseiSessionsTable).where(where);
  if (!existing) {
    res.status(404).json({ error: "Session not found." });
    return;
  }

  const respond = (s: typeof existing) =>
    res.json(
      FinishVoiceSessionResponse.parse({
        sessionId: s.id,
        status: "completed",
        durationSeconds: s.durationSeconds ?? 0,
        transcript: s.transcript,
        summary: s.summary,
        commonMistakes: s.commonMistakes,
      }),
    );
  if (existing.status === "completed") {
    respond(existing);
    return;
  }

  // Bill by server-measured wall time, never more than the session cap.
  const serverSeconds = Math.floor((Date.now() - existing.startedAt.getTime()) / 1000);
  const durationSeconds = Math.min(serverSeconds, body.data.durationSeconds + 5, config.maxSessionSeconds + 60);

  const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, existing.lessonId));
  // Mistakes recorded live by the agent (record_mistake tool) + any the client sent.
  const knownMistakes = [...new Set([...existing.commonMistakes, ...(body.data.commonMistakes ?? [])])];
  const generated = body.data.summary
    ? { summary: body.data.summary, mistakes: knownMistakes }
    : await summarizeSession(lesson?.titleVi ?? existing.lessonId, body.data.transcript, knownMistakes);

  const [session] = await db
    .update(senseiSessionsTable)
    .set({
      status: "completed",
      durationSeconds,
      transcript: body.data.transcript,
      summary: generated.summary,
      commonMistakes: generated.mistakes.slice(0, 50),
      completedAt: new Date(),
    })
    .where(and(where, eq(senseiSessionsTable.status, "active")))
    .returning();
  if (!session) {
    // The agent finalised it concurrently; return what is stored.
    const [stored] = await db.select().from(senseiSessionsTable).where(where);
    respond(stored!);
    return;
  }
  await recordStudy(userId, durationSeconds);
  if (session.mode === "demo" && body.data.lessonCompleted) {
    await setLessonProgress(userId, session.lessonId, "completed");
  }
  respond(session);
});

export default router;
