import type { Request, Response, NextFunction } from "express";
import { getUserByToken } from "../repo/inMemoryStore.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    createdAt: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "UNAUTHORIZED" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  const user = getUserByToken(token);
  if (!user) {
    res.status(401).json({ message: "INVALID_TOKEN" });
    return;
  }

  req.user = user;
  next();
}
