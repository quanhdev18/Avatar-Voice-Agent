import {
  AgentSession,
  AgentSessionEventTypes,
  ServerOptions,
  cli,
  defineAgent,
  voice,
  type JobContext,
} from "@livekit/agents";
import * as google from "@livekit/agents-plugin-google";
import { RoomEvent } from "@livekit/rtc-node";
import { fileURLToPath } from "node:url";
import { logger } from "./lib/logger";

const YUKI_SYSTEM_PROMPT = `You are Yuki-sensei, a warm, patient Japanese teacher for Vietnamese adults studying JLPT N5.
Speak in short turns. Teach one point at a time. Pair each useful Japanese phrase with a clear Vietnamese explanation, but never say labels such as "Japanese" or "Vietnamese" aloud. Use simple N5 vocabulary and grammar. Ask one brief question to check understanding after teaching. Correct grammar and pronunciation gently, explain the correction in Vietnamese, and adapt the amount of Japanese to the learner. Let the learner interrupt at any time; answer the interruption briefly and return to the lesson. Do not use emojis.`;

type RoomAction = {
  type?: string;
  text?: string;
  slower?: boolean;
  enabled?: boolean;
};

function languageFor(text: string): "ja" | "vi" | "mixed" {
  const hasJapanese = /[\u3040-\u30ff\u3400-\u9fff]/u.test(text);
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

async function publishCaption(
  ctx: JobContext,
  text: string,
  language: "ja" | "vi" | "mixed",
): Promise<void> {
  if (!text.trim()) return;
  const localParticipant = ctx.room.localParticipant;
  if (!localParticipant) return;
  const message = {
    type: "caption",
    text: text.trim(),
    language,
  };
  await localParticipant.publishData(
    new TextEncoder().encode(JSON.stringify(message)),
    { reliable: true, topic: "sensei.caption" },
  );
}

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect();

    const session = new AgentSession({
      llm: new google.realtime.RealtimeModel({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        voice: "Aoede",
        instructions: YUKI_SYSTEM_PROMPT,
      }),
    });

    let slowerPace = false;
    let lastTeacherText = "";

    session.on(AgentSessionEventTypes.UserInputTranscribed, (event) => {
      if (!event.isFinal || !event.transcript.trim()) return;
      void publishCaption(ctx, event.transcript, languageFor(event.transcript)).catch(
        (error: unknown) => {
          logger.warn({ err: error }, "Could not publish learner caption");
        },
      );
    });

    session.on(AgentSessionEventTypes.ConversationItemAdded, (event) => {
      const item = event.item as { role?: string; content?: unknown };
      if (item.role !== "assistant") return;
      const text = toText(item.content);
      if (!text) return;
      lastTeacherText = text;
      void publishCaption(ctx, text, languageFor(text)).catch((error: unknown) => {
        logger.warn({ err: error }, "Could not publish teacher caption");
      });
    });

    ctx.room.on(RoomEvent.DataReceived, (payload) => {
      let action: RoomAction;
      try {
        action = JSON.parse(new TextDecoder().decode(payload)) as RoomAction;
      } catch {
        return;
      }

      if (action.type === "interruption" && action.text?.trim()) {
        void (async () => {
          await session.interrupt({ force: true });
          const pace = slowerPace
            ? "Speak more slowly than usual, with clear pauses."
            : "Use your normal beginner-friendly speaking pace.";
          await session
            .generateReply({
              userInput: `${action.text?.trim()}\n\n${pace}`,
              inputModality: "text",
            })
            .waitForPlayout();
        })().catch((error: unknown) => {
          logger.warn({ err: error }, "Could not answer typed interruption");
        });
        return;
      }

      if (action.type === "slower" && typeof action.enabled === "boolean") {
        slowerPace = action.enabled;
        return;
      }

      if (action.type === "repeat") {
        const pace = action.slower || slowerPace
          ? "Repeat at a slower, clear pace."
          : "Repeat at your usual pace.";
        void session
          .generateReply({
            instructions: lastTeacherText
              ? `Repeat this last teaching point without adding a new one: ${lastTeacherText}. ${pace}`
              : `Repeat your most recent explanation. ${pace}`,
            inputModality: "text",
          })
          .waitForPlayout()
          .catch((error: unknown) => {
            logger.warn({ err: error }, "Could not repeat the last teaching point");
          });
      }
    });

    await session.start({
      room: ctx.room,
      agent: new voice.Agent({ instructions: YUKI_SYSTEM_PROMPT }),
    });
    await session
      .generateReply({
        instructions:
          "Greet the learner in Japanese, explain briefly in Vietnamese that today's lesson begins with greetings, and ask how they would say hello.",
        inputModality: "text",
      })
      .waitForPlayout();
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
