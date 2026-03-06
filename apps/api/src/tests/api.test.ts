import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("API v1", () => {
  const app = createApp();

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
});
