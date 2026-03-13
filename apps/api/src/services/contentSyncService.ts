import { logger } from "../lib/logger.js";
import { CONTENT_SYNC_INTERVAL_MS, syncAllContent } from "./contentService.js";

let syncInFlight: Promise<void> | null = null;

function runContentSync(): Promise<void> {
  if (syncInFlight) {
    return syncInFlight;
  }

  syncInFlight = syncAllContent()
    .then(() => {
      logger.info("content sync completed", {
        event: "content.sync.completed"
      });
    })
    .finally(() => {
      syncInFlight = null;
    });

  return syncInFlight;
}

export async function warmContentStore(): Promise<void> {
  await runContentSync();
  logger.info("content store warmup completed", {
    event: "content.sync.warmup_completed"
  });
}

export function startContentSyncScheduler(intervalMs = CONTENT_SYNC_INTERVAL_MS): () => void {
  const timer = setInterval(() => {
    void runContentSync()
      .catch((error: unknown) => {
        logger.error("content sync failed", {
          event: "content.sync.failed",
          intervalMs,
          error
        });
      });
  }, intervalMs);

  timer.unref?.();

  return () => {
    clearInterval(timer);
  };
}
