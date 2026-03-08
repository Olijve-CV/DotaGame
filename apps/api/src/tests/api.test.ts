import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("API v1", () => {
  const app = createApp();

  async function waitForSessionStatus(sessionId: string, statuses: string[]) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await request(app).get(`/api/v1/agent/sessions/${sessionId}`);
      if (statuses.includes(response.body.session?.status)) {
        return response;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    throw new Error(`session ${sessionId} did not reach expected status in time`);
  }

  async function waitForSessionCompletion(sessionId: string) {
    return waitForSessionStatus(sessionId, ["completed", "failed"]);
  }

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

  it("creates a root session and spawns child sessions through task calls", async () => {
    const sessionResponse = await request(app).post("/api/v1/agent/sessions").send({
      language: "en-US"
    });

    expect(sessionResponse.status).toBe(201);

    const turnResponse = await request(app)
      .post(`/api/v1/agent/sessions/${sessionResponse.body.session.id}/messages`)
      .send({
        message: "What is the latest patch trend for carry timings?",
        mode: "coach",
        language: "en-US"
      });

    expect(turnResponse.status).toBe(202);
    const completedResponse = await waitForSessionCompletion(sessionResponse.body.session.id);
    expect(completedResponse.body.session.status).toBe("completed");
    expect(completedResponse.body.children.length).toBeGreaterThanOrEqual(2);
    expect(
      completedResponse.body.messages.some((message: { parts?: Array<{ type?: string }> }) =>
        (message.parts ?? []).some((part) => part.type === "task_call")
      )
    ).toBe(true);

    const researcherChild = completedResponse.body.children.find(
      (child: { agent: string }) => child.agent === "researcher"
    );
    expect(researcherChild).toBeTruthy();

    const childDetail = await request(app).get(`/api/v1/agent/sessions/${researcherChild.id}`);
    expect(childDetail.status).toBe(200);
    expect(childDetail.body.session.parentSessionId).toBe(sessionResponse.body.session.id);
  });

  it("runs web_search and dota_live_search inside the researcher child session", async () => {
    const sessionResponse = await request(app).post("/api/v1/agent/sessions").send({
      language: "en-US"
    });

    const turnResponse = await request(app)
      .post(`/api/v1/agent/sessions/${sessionResponse.body.session.id}/messages`)
      .send({
        message: "What is the latest tournament meta for supports right now?",
        mode: "quick",
        language: "en-US"
      });

    expect(turnResponse.status).toBe(202);
    const completedResponse = await waitForSessionCompletion(sessionResponse.body.session.id);
    const researcherChild = completedResponse.body.children.find(
      (child: { agent: string }) => child.agent === "researcher"
    );
    const childDetail = await request(app).get(`/api/v1/agent/sessions/${researcherChild.id}`);

    expect(
      childDetail.body.messages.some((message: { parts?: Array<{ tool?: string }> }) =>
        (message.parts ?? []).some((part) => part.tool === "web_search")
      )
    ).toBe(true);
    expect(
      childDetail.body.messages.some((message: { parts?: Array<{ tool?: string }> }) =>
        (message.parts ?? []).some((part) => part.tool === "dota_live_search")
      )
    ).toBe(true);
  });

  it("lets the planner skip live web tools for evergreen coaching questions", async () => {
    const sessionResponse = await request(app).post("/api/v1/agent/sessions").send({
      language: "en-US"
    });

    const turnResponse = await request(app)
      .post(`/api/v1/agent/sessions/${sessionResponse.body.session.id}/messages`)
      .send({
        message: "How should I improve my laning fundamentals as a carry player?",
        mode: "coach",
        language: "en-US"
      });

    expect(turnResponse.status).toBe(202);
    const completedResponse = await waitForSessionCompletion(sessionResponse.body.session.id);
    const researcherChild = completedResponse.body.children.find(
      (child: { agent: string }) => child.agent === "researcher"
    );
    const childDetail = await request(app).get(`/api/v1/agent/sessions/${researcherChild.id}`);

    expect(
      childDetail.body.messages.some((message: { parts?: Array<{ tool?: string }> }) =>
        (message.parts ?? []).some((part) => part.tool === "knowledge_search")
      )
    ).toBe(true);
    expect(
      childDetail.body.messages.some((message: { parts?: Array<{ tool?: string }> }) =>
        (message.parts ?? []).some((part) => part.tool === "web_search")
      )
    ).toBe(false);
  });

  it("supports abort then resume on the same root session", async () => {
    const sessionResponse = await request(app).post("/api/v1/agent/sessions").send({
      language: "en-US"
    });

    const sessionId = sessionResponse.body.session.id;
    const turnResponse = await request(app)
      .post(`/api/v1/agent/sessions/${sessionId}/messages`)
      .send({
        message: "Use recent patches and tournament context to explain support warding priorities.",
        mode: "coach",
        language: "en-US"
      });

    expect(turnResponse.status).toBe(202);

    const abortResponse = await request(app)
      .post(`/api/v1/agent/sessions/${sessionId}/control`)
      .send({ action: "abort" });

    expect(abortResponse.status).toBe(200);
    expect(abortResponse.body.session.status).toBe("paused");

    const pausedResponse = await waitForSessionStatus(sessionId, ["paused"]);
    expect(pausedResponse.body.session.status).toBe("paused");

    const resumeResponse = await request(app)
      .post(`/api/v1/agent/sessions/${sessionId}/control`)
      .send({ action: "resume" });

    expect(resumeResponse.status).toBe(200);

    const completedResponse = await waitForSessionCompletion(sessionId);
    expect(completedResponse.body.session.status).toBe("completed");
  });

  it("retries the same root session and spawns a fresh set of child sessions", async () => {
    const sessionResponse = await request(app).post("/api/v1/agent/sessions").send({
      language: "en-US"
    });

    const sessionId = sessionResponse.body.session.id;
    const firstTurnResponse = await request(app)
      .post(`/api/v1/agent/sessions/${sessionId}/messages`)
      .send({
        message: "Explain my carry laning fundamentals.",
        mode: "coach",
        language: "en-US"
      });

    expect(firstTurnResponse.status).toBe(202);

    const firstCompleted = await waitForSessionCompletion(sessionId);
    expect(firstCompleted.body.session.status).toBe("completed");
    const firstChildCount = firstCompleted.body.children.length;

    const retryResponse = await request(app)
      .post(`/api/v1/agent/sessions/${sessionId}/control`)
      .send({ action: "retry" });

    expect(retryResponse.status).toBe(200);

    const secondCompleted = await waitForSessionCompletion(sessionId);
    expect(secondCompleted.body.session.status).toBe("completed");
    expect(secondCompleted.body.children.length).toBeGreaterThan(firstChildCount);
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
