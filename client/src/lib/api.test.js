import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, setCsrfToken } from "./api";

function mockJsonResponse(payload, { status = 200, ok = true } = {}) {
  return {
    status,
    ok,
    json: vi.fn().mockResolvedValue(payload)
  };
}

describe("lib/api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    setCsrfToken("");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("anexa CSRF em metodos mutaveis", async () => {
    setCsrfToken("csrf-teste");
    fetch.mockResolvedValue(mockJsonResponse({ ok: true }));

    await api.createMix({
      name: "Mix de Teste",
      category: "foco",
      scenarioKey: "cenario",
      theme: "cafe",
      source: "custom",
      mixer: { rain: 0.5 }
    });

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/mixes");
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    expect(options.headers["X-CSRF-Token"]).toBe("csrf-teste");
  });

  it("nao envia CSRF em GET", async () => {
    setCsrfToken("csrf-nao-deve-ir");
    fetch.mockResolvedValue(mockJsonResponse([]));

    await api.getSounds();

    const [, options] = fetch.mock.calls[0];
    expect(options.method).toBe("GET");
    expect(options.headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("rotaciona CSRF quando o backend devolve novo token", async () => {
    fetch
      .mockResolvedValueOnce(mockJsonResponse({ csrfToken: "csrf-rotacionado", items: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ ok: true }));

    await api.getSounds();
    await api.deleteMix("mix-123");

    const [, secondOptions] = fetch.mock.calls[1];
    expect(secondOptions.method).toBe("DELETE");
    expect(secondOptions.headers["X-CSRF-Token"]).toBe("csrf-rotacionado");
  });
});
