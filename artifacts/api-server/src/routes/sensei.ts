import { AccessToken } from "livekit-server-sdk";
import { getAuth } from "@clerk/express";
import { randomUUID } from "node:crypto";
import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import {
  FinishVoiceSessionBody,
  FinishVoiceSessionParams,
  FinishVoiceSessionResponse,
  GetVoiceStatusResponse,
  StartVoiceSessionBody,
  StartVoiceSessionResponse,
} from "@workspace/api-zod";
import { and, db, eq, senseiSessionsTable } from "@workspace/db";

const router: IRouter = Router();

function missingVoiceProviders(): Array<"livekit" | "gemini"> {
  const missing: Array<"livekit" | "gemini"> = [];
  if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    missing.push("livekit");
  }
  if (!process.env.GOOGLE_API_KEY) {
    missing.push("gemini");
  }
  return missing;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Sign in is required to use the classroom." });
    return;
  }
  next();
}

router.get("/sensei/voice-status", (_req, res): void => {
  const missingProviders = missingVoiceProviders();
  res.json(GetVoiceStatusResponse.parse({
    available: missingProviders.length === 0,
    missingProviders,
  }));
});

router.post("/sensei/sessions", requireAuth, async (req, res): Promise<void> => {
  const body = StartVoiceSessionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const missingProviders = missingVoiceProviders();
  if (missingProviders.length > 0) {
    res.status(503).json({
      error: "Voice providers are not configured.",
      missingProviders,
    });
    return;
  }

  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in is required to use the classroom." });
    return;
  }

  const roomName = `sensei-${randomUUID()}`;
  const expiresInSeconds = 15 * 60;
  const accessToken = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    { identity: userId, ttl: `${expiresInSeconds}s`, name: "Learner" },
  );
  accessToken.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  const participantToken = await accessToken.toJwt();

  const [session] = await db
    .insert(senseiSessionsTable)
    .values({
      userId,
      lessonId: body.data.lessonId,
      roomName,
      status: "active",
      transcript: [],
      commonMistakes: [],
    })
    .returning({ id: senseiSessionsTable.id });

  res.status(201).json(StartVoiceSessionResponse.parse({
    sessionId: session.id,
    roomName,
    livekitUrl: process.env.LIVEKIT_URL,
    participantToken,
    tokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  }));
});

router.post(
  "/sensei/sessions/:sessionId/finish",
  requireAuth,
  async (req, res): Promise<void> => {
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

    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Sign in is required to use the classroom." });
      return;
    }

    const where = and(
      eq(senseiSessionsTable.id, params.data.sessionId),
      eq(senseiSessionsTable.userId, userId),
    );
    const [existing] = await db.select().from(senseiSessionsTable).where(where);
    if (!existing) {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    if (existing.status === "completed") {
      res.json(FinishVoiceSessionResponse.parse({
        sessionId: existing.id,
        status: "completed",
        durationSeconds: existing.durationSeconds ?? 0,
        transcript: existing.transcript,
        summary: existing.summary,
        commonMistakes: existing.commonMistakes,
      }));
      return;
    }

    const [session] = await db
      .update(senseiSessionsTable)
      .set({
        status: "completed",
        durationSeconds: body.data.durationSeconds,
        transcript: body.data.transcript,
        summary: body.data.summary ?? null,
        commonMistakes: body.data.commonMistakes ?? [],
        completedAt: new Date(),
      })
      .where(where)
      .returning();

    res.json(FinishVoiceSessionResponse.parse({
      sessionId: session.id,
      status: "completed",
      durationSeconds: session.durationSeconds ?? 0,
      transcript: session.transcript,
      summary: session.summary,
      commonMistakes: session.commonMistakes,
    }));
  },
);

export default router;
