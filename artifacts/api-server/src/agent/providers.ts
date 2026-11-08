/**
 * Provider interfaces so the realtime voice model and the avatar can be swapped
 * by env var without touching the teaching logic.
 *
 *   VOICE_PROVIDER = gemini (default) | openai
 *   AVATAR_PROVIDER = liveavatar | none (default)
 */
import type { AgentSession, llm } from "@livekit/agents";
import * as googlePlugin from "@livekit/agents-plugin-google";
import * as openaiPlugin from "@livekit/agents-plugin-openai";
import type { Room } from "@livekit/rtc-node";
import { config } from "../lib/config";
import { logger } from "../lib/logger";

export interface VoiceProvider {
  name: string;
  createModel(instructions: string): llm.RealtimeModel;
}

export interface AvatarProvider {
  name: string;
  /** Identity the avatar participant joins with (client renders its video track). */
  participantIdentity: string;
  start(session: AgentSession, room: Room): Promise<void>;
}

const geminiProvider: VoiceProvider = {
  name: "gemini",
  createModel(instructions) {
    return new googlePlugin.realtime.RealtimeModel({
      model: process.env.GEMINI_REALTIME_MODEL ?? "gemini-2.5-flash-native-audio-preview-12-2025",
      voice: process.env.GEMINI_VOICE ?? "Aoede",
      instructions,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    }) as unknown as llm.RealtimeModel;
  },
};

const openaiProvider: VoiceProvider = {
  name: "openai",
  createModel() {
    return new openaiPlugin.realtime.RealtimeModel({
      model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime",
      voice: process.env.OPENAI_VOICE ?? "shimmer",
    }) as unknown as llm.RealtimeModel;
  },
};

export function createVoiceProvider(): VoiceProvider {
  return config.voiceProvider === "openai" ? openaiProvider : geminiProvider;
}

export async function createAvatarProvider(): Promise<AvatarProvider | null> {
  if (config.avatarProvider !== "liveavatar" || !process.env.LIVEAVATAR_API_KEY) return null;
  const identity = "sensei-avatar";
  return {
    name: "liveavatar",
    participantIdentity: identity,
    async start(session, room) {
      const { AvatarSession } = await import("@livekit/agents-plugin-liveavatar");
      const avatar = new AvatarSession({
        avatarId: process.env.LIVEAVATAR_AVATAR_ID,
        apiKey: process.env.LIVEAVATAR_API_KEY,
        isSandbox: process.env.LIVEAVATAR_SANDBOX === "true",
        avatarParticipantIdentity: identity,
        avatarParticipantName: "Yuki-sensei",
      });
      await avatar.start(session, room);
      logger.info("LiveAvatar session started");
    },
  };
}
