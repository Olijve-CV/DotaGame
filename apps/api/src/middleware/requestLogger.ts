import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { runWithRequestContext } from "../lib/requestContext.js";

const REQUEST_ID_HEADER = "x-request-id";
const TRACE_ID_HEADER = "x-trace-id";

function getLevelForStatusCode(statusCode: number): "info" | "warn" | "error" {
  if (statusCode >= 500) {
    return "error";
  }
  if (statusCode >= 400) {
    return "warn";
  }
  return "info";
}

function getDurationMs(startedAt: bigint): number {
  return Number(((process.hrtime.bigint() - startedAt) * 10_000n) / 1_000_000n) / 10;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const path = req.originalUrl || req.url;
  const requestId = req.header(REQUEST_ID_HEADER)?.trim() || randomUUID();
  const traceId = req.header(TRACE_ID_HEADER)?.trim() || requestId;
  const startedAt = process.hrtime.bigint();

  res.setHeader(REQUEST_ID_HEADER, requestId);
  res.setHeader(TRACE_ID_HEADER, traceId);

  runWithRequestContext(
    {
      requestId,
      traceId,
      method: req.method,
      path
    },
    () => {
      let finished = false;

      res.on("finish", () => {
        finished = true;
        const level = getLevelForStatusCode(res.statusCode);
        logger[level]("request completed", {
          event: "http.request.completed",
          method: req.method,
          path,
          statusCode: res.statusCode,
          durationMs: getDurationMs(startedAt)
        });
      });

      res.on("close", () => {
        if (finished) {
          return;
        }

        logger.warn("request aborted", {
          event: "http.request.aborted",
          method: req.method,
          path,
          durationMs: getDurationMs(startedAt)
        });
      });

      next();
    }
  );
}
