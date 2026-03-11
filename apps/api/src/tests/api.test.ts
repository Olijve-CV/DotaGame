import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";

describe("API v1", () => {
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
  const app = createApp();
  const fetchMock = vi.fn(mockOpenAiFetch);

  function jsonResponse(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }

  async function mockOpenAiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const payload = JSON.parse(String(init?.body ?? "{}")) as {
      response_format?: { type?: string };
      messages?: Array<{
        role?: string;
        content?: string;
      }>;
    };

    if (url.endsWith("/chat/completions")) {
      if (payload.response_format?.type === "json_object") {
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  answer: "Coaching plan: stabilize lane pressure and item timing around your first core.",
                  confidence: 0.72,
                  followUps: ["Want a lane checklist?", "Need matchup-specific advice?"]
                })
              }
            }
          ]
        });
      }

      if ((payload.messages ?? []).some((message) => message.role === "tool")) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: "Use the retrieved evidence to adjust your timing and map pressure decisions."
              }
            }
          ]
        });
      }

      const userMessage =
        [...(payload.messages ?? [])].reverse().find((message) => message.role === "user")?.content ?? "";

      if (/latest tournament meta for supports right now/i.test(userMessage)) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: "",
                tool_calls: [
                  {
                    id: "call-dota-live",
                    type: "function",
                    function: {
                      name: "dota_live_search",
                      arguments: JSON.stringify({ input: userMessage })
                    }
                  },
                  {
                    id: "call-web",
                    type: "function",
                    function: {
                      name: "web_search",
                      arguments: JSON.stringify({ input: userMessage })
                    }
                  }
                ]
              }
            }
          ]
        });
      }

      if (/latest patch trend for carry timings/i.test(userMessage)) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: "",
                tool_calls: [
                  {
                    id: "call-knowledge",
                    type: "function",
                    function: {
                      name: "knowledge_search",
                      arguments: JSON.stringify({ input: userMessage })
                    }
                  },
                  {
                    id: "call-dota-live",
                    type: "function",
                    function: {
                      name: "dota_live_search",
                      arguments: JSON.stringify({ input: userMessage })
                    }
                  }
                ]
              }
            }
          ]
        });
      }

      return jsonResponse({
        choices: [
          {
            message: {
              content: "",
              tool_calls: [
                {
                  id: "call-knowledge",
                  type: "function",
                  function: {
                    name: "knowledge_search",
                    arguments: JSON.stringify({ input: userMessage })
                  }
                }
              ]
            }
          }
        ]
      });
    }

    if (url.endsWith("/responses")) {
      return jsonResponse({
        output_text: "General web search found these sources:\n1. Recent support meta roundup (example.com)",
        output: [
          {
            type: "web_search_call",
            action: {
              sources: [{ title: "Recent support meta roundup", url: "https://example.com/support-meta" }]
            }
          }
        ]
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  }

  beforeAll(() => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    vi.stubGlobal("fetch", fetchMock);
  });

  beforeEach(() => {
    fetchMock.mockClear();
    fetchMock.mockImplementation(mockOpenAiFetch);
  });

  afterAll(() => {
    if (originalOpenAiApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiApiKey;
    }
    vi.unstubAllGlobals();
  });

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

  function findLastAssistantMessage(
    messages: Array<{
      role?: string;
      content?: string;
      parts?: Array<{ type?: string; status?: string }>;
    }>
  ) {
    return [...messages].reverse().find((message) => message.role === "assistant");
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

  it("runs the agent loop inside a single root session", async () => {
    const sessionResponse = await request(app).post("/api/v1/agent/sessions").send({
      language: "en-US"
    });

    expect(sessionResponse.status).toBe(201);

    const turnResponse = await request(app)
      .post(`/api/v1/agent/sessions/${sessionResponse.body.session.id}/messages`)
      .send({
        message: "What is the latest patch trend for carry timings?",
        language: "en-US"
      });

    expect(turnResponse.status).toBe(202);
    const completedResponse = await waitForSessionCompletion(sessionResponse.body.session.id);
    const assistantMessage = findLastAssistantMessage(completedResponse.body.messages);
    const completedToolPart = (assistantMessage?.parts ?? []).find(
      (part: { type?: string; status?: string }) => part.type === "tool_call" && part.status === "completed"
    ) as
      | {
          startedAt?: string;
          completedAt?: string | null;
          durationMs?: number | null;
        }
      | undefined;

    expect(completedResponse.body.session.status).toBe("completed");
    expect(completedResponse.body.children).toEqual([]);
    expect(completedResponse.body.insight.toolCallCount).toBeGreaterThan(0);
    expect(completedResponse.body.insight.messageCount).toBeGreaterThanOrEqual(2);
    expect(assistantMessage).toBeTruthy();
    expect(
      (assistantMessage?.parts ?? []).some((part: { type?: string }) => part.type === "thinking")
    ).toBe(true);
    expect(
      (assistantMessage?.parts ?? []).some((part: { type?: string }) => part.type === "tool_call")
    ).toBe(true);
    expect(completedToolPart?.startedAt).toBeTruthy();
    expect(completedToolPart?.completedAt).toBeTruthy();
    expect(completedToolPart?.durationMs).not.toBeNull();
    expect(Boolean(assistantMessage?.content?.trim())).toBe(true);
  });

  it("fails the agent session when the model step fails instead of using fallback tools", async () => {
    fetchMock.mockImplementationOnce(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/chat/completions")) {
        return jsonResponse({ error: "model unavailable" }, 500);
      }
      return mockOpenAiFetch(input, init);
    });

    const sessionResponse = await request(app).post("/api/v1/agent/sessions").send({
      language: "en-US"
    });

    const turnResponse = await request(app)
      .post(`/api/v1/agent/sessions/${sessionResponse.body.session.id}/messages`)
      .send({
        message: "What is the latest patch trend for carry timings?",
        language: "en-US"
      });

    expect(turnResponse.status).toBe(202);
    const completedResponse = await waitForSessionCompletion(sessionResponse.body.session.id);
    const assistantMessage = findLastAssistantMessage(completedResponse.body.messages);

    expect(completedResponse.body.session.status).toBe("failed");
    expect(
      completedResponse.body.messages.some((message: { parts?: Array<{ type?: string }> }) =>
        (message.parts ?? []).some((part) => part.type === "tool_call")
      )
    ).toBe(false);
    expect(
      (assistantMessage?.parts ?? []).some(
        (part: { type?: string; status?: string }) => part.type === "thinking" && part.status === "failed"
      )
    ).toBe(true);
    expect(
      completedResponse.body.messages.some(
        (message: { role?: string; content?: string }) =>
          message.role === "assistant" && message.content === "OPENAI_AGENT_FAILED:500"
      )
    ).toBe(true);
  });

  it("runs web_search and dota_live_search in the main session for time-sensitive questions", async () => {
    const sessionResponse = await request(app).post("/api/v1/agent/sessions").send({
      language: "en-US"
    });

    const turnResponse = await request(app)
      .post(`/api/v1/agent/sessions/${sessionResponse.body.session.id}/messages`)
      .send({
        message: "What is the latest tournament meta for supports right now?",
        language: "en-US"
      });

    expect(turnResponse.status).toBe(202);
    const completedResponse = await waitForSessionCompletion(sessionResponse.body.session.id);

    expect(
      completedResponse.body.messages.some((message: { parts?: Array<{ tool?: string }> }) =>
        (message.parts ?? []).some((part) => part.tool === "web_search")
      )
    ).toBe(true);
    expect(
      completedResponse.body.messages.some((message: { parts?: Array<{ tool?: string }> }) =>
        (message.parts ?? []).some((part) => part.tool === "dota_live_search")
      )
    ).toBe(true);
  });

  it("skips live web tools for evergreen coaching questions", async () => {
    const sessionResponse = await request(app).post("/api/v1/agent/sessions").send({
      language: "en-US"
    });

    const turnResponse = await request(app)
      .post(`/api/v1/agent/sessions/${sessionResponse.body.session.id}/messages`)
      .send({
        message: "How should I improve my laning fundamentals as a carry player?",
        language: "en-US"
      });

    expect(turnResponse.status).toBe(202);
    const completedResponse = await waitForSessionCompletion(sessionResponse.body.session.id);

    expect(
      completedResponse.body.messages.some((message: { parts?: Array<{ tool?: string }> }) =>
        (message.parts ?? []).some((part) => part.tool === "knowledge_search")
      )
    ).toBe(true);
    expect(
      completedResponse.body.messages.some((message: { parts?: Array<{ tool?: string }> }) =>
        (message.parts ?? []).some((part) => part.tool === "web_search")
      )
    ).toBe(false);
    expect(completedResponse.body.children).toEqual([]);
  });

  it("keeps the session title anchored to the first user prompt", async () => {
    const sessionResponse = await request(app).post("/api/v1/agent/sessions").send({
      language: "en-US"
    });

    await request(app)
      .post(`/api/v1/agent/sessions/${sessionResponse.body.session.id}/messages`)
      .send({
        message: "Explain the latest patch trend for carry timings.",
        language: "en-US"
      });

    await waitForSessionCompletion(sessionResponse.body.session.id);

    await request(app)
      .post(`/api/v1/agent/sessions/${sessionResponse.body.session.id}/messages`)
      .send({
        message: "Now summarize the same issue for support players.",
        language: "en-US"
      });

    const completedResponse = await waitForSessionCompletion(sessionResponse.body.session.id);

    expect(completedResponse.body.session.title).toContain("Explain the latest patch trend");
    expect(completedResponse.body.session.title).not.toContain("Now summarize the same issue");
    expect(completedResponse.body.insight.lastUserMessage).toContain("support players");
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
  }, 15000);

  it("lists hero avatars and updates the profile avatar", async () => {
    const avatarsResponse = await request(app).get("/api/v1/hero-avatars");
    expect(avatarsResponse.status).toBe(200);
    expect(avatarsResponse.body.items.length).toBeGreaterThan(0);
    expect(avatarsResponse.body.items[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        name: expect.any(String),
        image: expect.any(String)
      })
    );
    expect(avatarsResponse.body.items[0].roles).toEqual(expect.any(Array));
    expect(["str", "agi", "int", "all", undefined]).toContain(
      avatarsResponse.body.items[0].primaryAttr
    );
    expect(["Melee", "Ranged", undefined]).toContain(
      avatarsResponse.body.items[0].attackType
    );

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
  }, 15000);
});
