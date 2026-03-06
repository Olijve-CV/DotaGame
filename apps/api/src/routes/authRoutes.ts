import { Router } from "express";
import { z } from "zod";
import { createUser, loginUser } from "../repo/inMemoryStore.js";

const authBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).max(32).optional(),
  avatarHeroId: z.number().int().positive().optional()
});

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = authBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }

  try {
    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const displayName = parsed.data.name?.trim() || normalizedEmail;
    const user = await createUser(
      normalizedEmail,
      parsed.data.password,
      displayName,
      parsed.data.avatarHeroId
    );
    const login = loginUser(normalizedEmail, parsed.data.password);
    res.status(201).json({ user, token: login.token });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") {
      res.status(409).json({ message: "EMAIL_EXISTS" });
      return;
    }
    if (error instanceof Error && error.message === "INVALID_AVATAR") {
      res.status(400).json({ message: "INVALID_AVATAR" });
      return;
    }
    res.status(500).json({ message: "REGISTER_FAILED" });
  }
});

authRouter.post("/login", (req, res) => {
  const parsed = authBodySchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }

  try {
    const result = loginUser(parsed.data.email, parsed.data.password);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
      res.status(401).json({ message: "INVALID_CREDENTIALS" });
      return;
    }
    res.status(500).json({ message: "LOGIN_FAILED" });
  }
});
