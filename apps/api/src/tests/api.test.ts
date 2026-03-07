import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("API v1", () => {
  const app = createApp();

  it("returns a request id header for traceability", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBeTruthy();
    expect(response.headers["x-trace-id"]).toBeTruthy();
  });

  it("preserves an incoming trace id", async () => {
    const response = await request(app).get("/health").set("x-trace-id", "trace-abc-123");

    expect(response.status).toBe(200);
    expect(response.headers["x-trace-id"]).toBe("trace-abc-123");
  });

  it("filters articles by language", async () => {
    const response = await request(app).get("/api/v1/articles?language=zh-CN");
    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThan(0);
    for (const item of response.body.items) {
      expect(item.language).toBe("zh-CN");
    }
  });

  it("supports chat responses with citations", async () => {
    const response = await request(app).post("/api/v1/chat").send({
      question: "How to improve laning for carry hero?",
      mode: "coach",
      language: "en-US"
    });

    expect(response.status).toBe(200);
    expect(response.body.answer).toContain("Coaching plan:");
    expect(response.body.citations.length).toBeGreaterThan(0);
  });

  it("accepts chat payloads sent as text/plain JSON", async () => {
    const response = await request(app)
      .post("/api/v1/chat")
      .set("Content-Type", "text/plain")
      .send(
        JSON.stringify({
          question: "我线上总是被压，先修补刀还是先修站位？",
          mode: "quick",
          language: "zh-CN"
        })
      );

    expect(response.status).toBe(200);
    expect(response.body.answer).toBeTruthy();
    expect(response.body.followUps.length).toBeGreaterThan(0);
  });

  it("creates an agent thread and completes a multi-agent run automatically", async () => {
    const threadResponse = await request(app).post("/api/v1/agent/threads").send({
      language: "en-US"
    });

    expect(threadResponse.status).toBe(201);

    const runResponse = await request(app)
      .post(`/api/v1/agent/threads/${threadResponse.body.thread.id}/runs`)
      .send({
        message: "What is the latest patch trend for carry timings?",
        mode: "coach",
        language: "en-US",
        approvalPolicy: "auto"
      });

    expect(runResponse.status).toBe(200);
    expect(runResponse.body.runs[0].status).toBe("completed");
    expect(runResponse.body.runs[0].steps.length).toBeGreaterThan(2);
    expect(runResponse.body.messages.some((message: { role: string }) => message.role === "assistant")).toBe(
      true
    );
  });

  it("pauses an agent run for approval and resumes after approval", async () => {
    const threadResponse = await request(app).post("/api/v1/agent/threads").send({
      language: "en-US"
    });

    const runResponse = await request(app)
      .post(`/api/v1/agent/threads/${threadResponse.body.thread.id}/runs`)
      .send({
        message: "What is the latest tournament meta for supports right now?",
        mode: "quick",
        language: "en-US",
        approvalPolicy: "always"
      });

    expect(runResponse.status).toBe(200);
    expect(runResponse.body.runs[0].status).toBe("waiting_approval");
    expect(runResponse.body.runs[0].approvals[0].status).toBe("pending");

    const approval = runResponse.body.runs[0].approvals[0];
    const resumeResponse = await request(app)
      .post(`/api/v1/agent/runs/${runResponse.body.runs[0].id}/approvals/${approval.id}`)
      .send({ decision: "approve" });

    expect(resumeResponse.status).toBe(200);
    expect(resumeResponse.body.runs[0].status).toBe("completed");
    expect(resumeResponse.body.runs[0].approvals[0].status).toBe("approved");
  });

  it("uses the email as fallback name and does not expose password fields", async () => {
    const registerResponse = await request(app).post("/api/v1/auth/register").send({
      email: "player@example.com",
      password: "secret12"
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.name).toBe("player@example.com");
    expect(registerResponse.body.user.avatar).toBeTruthy();
    expect(registerResponse.body.user.password).toBeUndefined();
    expect(registerResponse.body.user.passwordHash).toBeUndefined();

    const meResponse = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${registerResponse.body.token}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.name).toBe("player@example.com");
    expect(meResponse.body.user.avatar).toBeTruthy();
    expect(meResponse.body.user.password).toBeUndefined();
    expect(meResponse.body.user.passwordHash).toBeUndefined();
  });

  it("lists hero avatars and updates the profile avatar", async () => {
    const avatarsResponse = await request(app).get("/api/v1/hero-avatars");
    expect(avatarsResponse.status).toBe(200);
    expect(avatarsResponse.body.items.length).toBeGreaterThan(0);

    const chosenAvatarId = avatarsResponse.body.items[0].id;
    const registerResponse = await request(app).post("/api/v1/auth/register").send({
      email: "avatar@example.com",
      password: "secret12",
      avatarHeroId: chosenAvatarId
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.avatar.id).toBe(chosenAvatarId);

    const nextAvatarId =
      avatarsResponse.body.items[1]?.id ?? avatarsResponse.body.items[0].id;
    const updateResponse = await request(app)
      .patch("/api/v1/users/me/avatar")
      .set("Authorization", `Bearer ${registerResponse.body.token}`)
      .send({ avatarHeroId: nextAvatarId });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.user.avatar.id).toBe(nextAvatarId);
  });
});
