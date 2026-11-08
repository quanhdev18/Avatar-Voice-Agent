import app from "./app";
import { logger } from "./lib/logger";
import { GameServer } from "./game/server";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  const voiceConfigReady = Boolean(
    process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET &&
    process.env.GOOGLE_API_KEY,
  );

  if (!voiceConfigReady) {
    logger.info(
      "Sensei voice worker is waiting for LiveKit and Gemini credentials",
    );
    return;
  }

  const workerPath = fileURLToPath(new URL("./senseiAgent.mjs", import.meta.url));
  const worker = spawn(process.execPath, [workerPath], {
    env: process.env,
    stdio: "ignore",
  });

  worker.once("spawn", () => {
    logger.info("Sensei LiveKit agent worker started");
  });
  worker.once("error", (workerError) => {
    logger.error({ err: workerError }, "Sensei agent worker failed to start");
  });
  worker.once("exit", (code, signal) => {
    logger.warn({ code, signal }, "Sensei agent worker exited");
  });

  process.once("SIGTERM", () => worker.kill("SIGTERM"));
  process.once("SIGINT", () => worker.kill("SIGINT"));
});

// Que Chiến multiplayer: WebSocket endpoint at /api/game/ws on the same port.
new GameServer(server);
