import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("API contracts", () => {
  const app = createApp();

  it("GET /api/health responde status e payload esperado", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      service: "aurora-soundlab-api"
    });
  });

  it("adiciona X-Request-Id em respostas para rastreabilidade", async () => {
    const response = await request(app).get("/api/sounds");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBeTypeOf("string");
    expect(response.headers["x-request-id"].length).toBeGreaterThanOrEqual(8);
  });

  it("GET /api/presets/categories retorna categorias oficiais", async () => {
    const response = await request(app).get("/api/presets/categories");

    expect(response.status).toBe(200);
    expect(response.body).toContain("foco");
    expect(response.body).toContain("sono");
  });

  it("impede acesso anonimo em endpoint autenticado", async () => {
    const response = await request(app).get("/api/overview");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Nao autenticado.");
  });

  it("retorna 404 consistente para rotas inexistentes", async () => {
    const response = await request(app).get("/api/nao-existe");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Rota nao encontrada.");
  });
});
