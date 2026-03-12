import type { Request, Response, NextFunction } from "express";
import type { UserProfile } from "@dotagame/contracts";
import { logger } from "../lib/logger.js";
import { getUserByToken } from "../repo/inMemoryStore.js";

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    logger.warn("authentication failed: missing bearer token", {
      event: "auth.unauthorized",
      reason: "missing_bearer_token"
    });
    res.status(401).json({ message: "UNAUTHORIZED" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  const user = await getUserByToken(token);
  if (!user) {
    logger.warn("authentication failed: invalid token", {
      event: "auth.invalid_token"
    });
    res.status(401).json({ message: "INVALID_TOKEN" });
    return;
  }

  req.user = user;
  next();
}
