import app from "./app";
import { logger } from "./lib/logger";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { seedCurriculum } from "./lib/learner";
import { missingVoiceProviders } from "./lib/config";

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

await seedCurriculum().catch((err: unknown) => {
  logger.error({ err }, "Could not seed curriculum (is DATABASE_URL reachable?)");
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  const voiceConfigReady = missingVoiceProviders().length === 0;

  if (!voiceConfigReady) {
    logger.info(
      "Sensei voice worker is waiting for LiveKit and voice-model credentials (demo classroom still works)",
    );
    return;
  }

  const workerPath = fileURLToPath(new URL("./senseiAgent.mjs", import.meta.url));
  const worker = spawn(process.execPath, [workerPath, process.env.NODE_ENV === "production" ? "start" : "dev"], {
    env: process.env,
    stdio: "inherit",
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
