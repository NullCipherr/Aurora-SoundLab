import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { nanoid } from "nanoid";
import { authRouter } from "./routes/auth.js";
import { mixesRouter } from "./routes/mixes.js";
import { presetsRouter } from "./routes/presets.js";
import { authenticate, requireCsrf } from "./auth.js";
import { categories, cinematicPresets, soundLibrary } from "./soundLibrary.js";
import { getHistory, getMixes } from "./storage.js";

/**
 * Cria e configura a API HTTP.
 * Mantemos este factory separado do bootstrap (`index.js`) para permitir
 * testes de integração sem alocar porta real no processo.
 */
export function createApp() {
  const app = express();
  const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    // Correlaciona logs de request entre camadas (proxy, API e observabilidade).
    res.setHeader("X-Request-Id", nanoid(10));
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc:
            process.env.NODE_ENV === "production"
              ? ["'self'"]
              : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'", frontendOrigin],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"]
        }
      },
      referrerPolicy: {
        policy: "strict-origin-when-cross-origin"
      },
      hsts:
        process.env.NODE_ENV === "production"
          ? {
              maxAge: 15552000,
              includeSubDomains: true,
              preload: true
            }
          : false
    })
  );

  app.use(
    cors({
      origin: frontendOrigin,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token"]
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: "100kb" }));

  app.use((req, res, next) => {
    if (process.env.NODE_ENV !== "production") {
      return next();
    }

    // Em produção exigimos HTTPS mesmo atrás de proxy reverso.
    const proto = req.headers["x-forwarded-proto"];
    const secureByProxy = typeof proto === "string" && proto.includes("https");
    if (req.secure || secureByProxy) {
      return next();
    }

    return res.status(400).json({ error: "HTTPS obrigatorio em producao." });
  });

  const csrfExemptPaths = new Set([
    "/auth/login",
    "/auth/register",
    "/auth/password/forgot",
    "/auth/password/reset",
    "/auth/email/verify"
  ]);

  app.use("/api", (req, res, next) => {
    const method = req.method.toUpperCase();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) {
      return next();
    }

    // Endpoints públicos de autenticação aceitam POST sem sessão prévia.
    if (csrfExemptPaths.has(req.path)) {
      return next();
    }

    return requireCsrf(req, res, next);
  });

  app.get("/api/health", (_, res) => {
    res.json({ ok: true, service: "aurora-soundlab-api" });
  });

  app.get("/api/sounds", (_, res) => {
    res.json(soundLibrary);
  });

  app.get("/api/scenarios", (_, res) => {
    const asMap = Object.fromEntries(cinematicPresets.map((preset) => [preset.key, preset]));
    res.json(asMap);
  });

  app.get("/api/overview", authenticate, async (req, res) => {
    const [mixes, history] = await Promise.all([getMixes(), getHistory()]);

    const userMixes = mixes.filter((mix) => mix.userId === req.user.id);
    const userHistory = history.filter((entry) => entry.userId === req.user.id);

    const byCategory = categories.reduce((acc, category) => {
      acc[category] = userMixes.filter((mix) => mix.category === category).length;
      return acc;
    }, {});

    res.json({
      totalMixes: userMixes.length,
      favorites: userMixes.filter((mix) => mix.favorite).length,
      totalPlays: userMixes.reduce((acc, mix) => acc + (mix.playCount || 0), 0),
      historyEvents: userHistory.length,
      totalShares: userMixes.filter((mix) => Boolean(mix.share && !mix.share.revokedAt)).length,
      byCategory
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/presets", presetsRouter);
  app.use("/api/mixes", mixesRouter);

  app.use((_, res) => {
    res.status(404).json({ error: "Rota nao encontrada." });
  });

  app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    const status = Number(err.status || 500);
    const requestId = nanoid(12);

    if (status >= 500) {
      return res.status(500).json({
        error: "Erro interno do servidor.",
        requestId
      });
    }

    return res.status(status).json({
      error: "Erro na requisicao.",
      requestId
    });
  });

  return app;
}
