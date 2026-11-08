/** Central place for provider + limit configuration. Secrets never leave the server. */
export type VoiceProviderName = "gemini" | "openai";
export type AvatarProviderName = "liveavatar" | "none";

export const config = {
  voiceProvider: ((process.env.VOICE_PROVIDER ?? "gemini").toLowerCase() === "openai"
    ? "openai"
    : "gemini") as VoiceProviderName,
  avatarProvider: (process.env.AVATAR_PROVIDER ?? "").toLowerCase() === "liveavatar"
    ? ("liveavatar" as const)
    : ("none" as const),
  maxSessionSeconds: Number(process.env.MAX_SESSION_MINUTES ?? 15) * 60,
  defaultDailyMinutes: Number(process.env.DAILY_MINUTE_LIMIT ?? 30),
};

export function authMode(): "clerk" | "demo" {
  if (process.env.CLERK_SECRET_KEY) return "clerk";
  return "demo";
}

export function missingVoiceProviders(): Array<"livekit" | "gemini" | "openai"> {
  const missing: Array<"livekit" | "gemini" | "openai"> = [];
  if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    missing.push("livekit");
  }
  if (config.voiceProvider === "gemini" && !process.env.GOOGLE_API_KEY) missing.push("gemini");
  if (config.voiceProvider === "openai" && !process.env.OPENAI_API_KEY) missing.push("openai");
  return missing;
}

export function avatarConfigured(): AvatarProviderName {
  if (config.avatarProvider === "liveavatar" && process.env.LIVEAVATAR_API_KEY) return "liveavatar";
  return "none";
}
