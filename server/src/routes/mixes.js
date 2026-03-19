import crypto from "node:crypto";
import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { appendAudit, authenticate } from "../auth.js";
import { categories, soundLibrary } from "../soundLibrary.js";
import { getHistory, getMixes, saveHistory, saveMixes } from "../storage.js";

export const mixesRouter = Router();

const soundIds = new Set(soundLibrary.map((sound) => sound.id));

const mixSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(600).optional().default(""),
  category: z.enum(categories),
  scenarioKey: z.string().min(1).max(80).optional().default("personalizado"),
  theme: z.string().min(1).max(50).optional().default("custom"),
  source: z.string().min(1).max(50).optional().default("custom"),
  mixer: z.record(z.string(), z.number().min(0).max(1))
});

const shareSchema = z.object({
  expiresInHours: z.number().int().min(1).max(24 * 60).optional(),
  allowClone: z.boolean().optional().default(true)
});

function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Entrada invalida." });
    }
    req.validatedBody = parsed.data;
    return next();
  };
}

function randomShareId() {
  return crypto.randomBytes(24).toString("base64url");
}

function sanitizeMixer(mixer) {
  const sanitized = {};

  for (const [key, value] of Object.entries(mixer || {})) {
    if (!soundIds.has(key)) {
      continue;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      continue;
    }

    sanitized[key] = Math.min(1, Math.max(0, parsed));
  }

  return sanitized;
}

function normalizeMixPayload(payload) {
  return {
    name: String(payload.name || "").trim(),
    description: String(payload.description || "").trim(),
    category: String(payload.category || "foco").trim().toLowerCase(),
    scenarioKey: String(payload.scenarioKey || "personalizado").trim(),
    theme: String(payload.theme || "custom").trim(),
    source: String(payload.source || "custom").trim(),
    mixer: sanitizeMixer(payload.mixer)
  };
}

function toPublicSharedMix(mix) {
  return {
    id: mix.id,
    name: mix.name,
    description: mix.description,
    category: mix.category,
    scenarioKey: mix.scenarioKey,
    theme: mix.theme,
    source: mix.source,
    mixer: mix.mixer,
    createdAt: mix.createdAt,
    updatedAt: mix.updatedAt
  };
}

mixesRouter.get("/shared/:shareId", async (req, res) => {
  const shareId = String(req.params.shareId || "").trim();
  if (!shareId || shareId.length < 24) {
    return res.status(404).json({ error: "Compartilhamento nao encontrado." });
  }

  const mixes = await getMixes();
  const mix = mixes.find((item) => item.share?.shareId === shareId);

  if (!mix || mix.share?.revokedAt) {
    return res.status(404).json({ error: "Compartilhamento nao encontrado." });
  }

  if (mix.share?.expiresAt && Date.now() > new Date(mix.share.expiresAt).getTime()) {
    return res.status(410).json({ error: "Link de compartilhamento expirado." });
  }

  mix.share.lastAccessAt = new Date().toISOString();
  mix.share.accessCount = Number(mix.share.accessCount || 0) + 1;
  await saveMixes(mixes);

  return res.json({
    shareId,
    allowClone: Boolean(mix.share?.allowClone),
    mix: toPublicSharedMix(mix)
  });
});

mixesRouter.use(authenticate);

mixesRouter.get("/", async (req, res) => {
  const mixes = await getMixes();
  const category = String(req.query.category || "").trim().toLowerCase();
  const onlyFavorites = String(req.query.favorite || "") === "true";

  let userMixes = mixes.filter((mix) => mix.userId === req.user.id);

  if (category) {
    if (!categories.includes(category)) {
      return res.status(400).json({ error: "Categoria invalida." });
    }

    userMixes = userMixes.filter((mix) => mix.category === category);
  }

  if (onlyFavorites) {
    userMixes = userMixes.filter((mix) => mix.favorite);
  }

  userMixes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return res.json(userMixes);
});

mixesRouter.post("/", validateBody(mixSchema), async (req, res) => {
  const payload = normalizeMixPayload(req.validatedBody);
  if (!payload.name || Object.keys(payload.mixer).length === 0) {
    return res.status(400).json({ error: "Nome e mixer validos sao obrigatorios." });
  }

  if (!categories.includes(payload.category)) {
    return res.status(400).json({ error: "Categoria invalida." });
  }

  const mixes = await getMixes();
  const now = new Date().toISOString();

  const mix = {
    id: nanoid(12),
    userId: req.user.id,
    ...payload,
    favorite: false,
    playCount: 0,
    share: null,
    createdAt: now,
    updatedAt: now
  };

  mixes.push(mix);
  await saveMixes(mixes);

  await appendAudit("mix.created", req, { userId: req.user.id, mixId: mix.id });
  return res.status(201).json(mix);
});

mixesRouter.put("/:id", validateBody(mixSchema), async (req, res) => {
  const mixes = await getMixes();
  const mix = mixes.find((item) => item.id === req.params.id && item.userId === req.user.id);

  if (!mix) {
    return res.status(404).json({ error: "Mix nao encontrada." });
  }

  const payload = normalizeMixPayload(req.validatedBody);
  if (!payload.name || Object.keys(payload.mixer).length === 0) {
    return res.status(400).json({ error: "Nome e mixer validos sao obrigatorios." });
  }

  Object.assign(mix, payload, {
    updatedAt: new Date().toISOString()
  });

  await saveMixes(mixes);
  await appendAudit("mix.updated", req, { userId: req.user.id, mixId: mix.id });

  return res.json(mix);
});

mixesRouter.delete("/:id", async (req, res) => {
  const mixes = await getMixes();
  const target = mixes.find((item) => item.id === req.params.id && item.userId === req.user.id);

  if (!target) {
    return res.status(404).json({ error: "Mix nao encontrada." });
  }

  const nextMixes = mixes.filter((item) => item.id !== target.id);
  await saveMixes(nextMixes);

  await appendAudit("mix.deleted", req, { userId: req.user.id, mixId: target.id });
  return res.status(204).send();
});

mixesRouter.post("/:id/favorite", async (req, res) => {
  const mixes = await getMixes();
  const mix = mixes.find((item) => item.id === req.params.id && item.userId === req.user.id);

  if (!mix) {
    return res.status(404).json({ error: "Mix nao encontrada." });
  }

  mix.favorite = !mix.favorite;
  mix.updatedAt = new Date().toISOString();

  await saveMixes(mixes);
  await appendAudit("mix.favorite_toggled", req, {
    userId: req.user.id,
    mixId: mix.id,
    favorite: mix.favorite
  });

  return res.json(mix);
});

mixesRouter.post("/:id/duplicate", async (req, res) => {
  const mixes = await getMixes();
  const original = mixes.find((item) => item.id === req.params.id && item.userId === req.user.id);

  if (!original) {
    return res.status(404).json({ error: "Mix nao encontrada." });
  }

  const now = new Date().toISOString();
  const duplicate = {
    ...original,
    id: nanoid(12),
    name: `${original.name} (Copia)`,
    favorite: false,
    source: "duplicate",
    playCount: 0,
    share: null,
    createdAt: now,
    updatedAt: now
  };

  mixes.push(duplicate);
  await saveMixes(mixes);

  await appendAudit("mix.duplicated", req, {
    userId: req.user.id,
    mixId: duplicate.id,
    sourceMixId: original.id
  });

  return res.status(201).json(duplicate);
});

mixesRouter.post("/:id/play", async (req, res) => {
  const mixes = await getMixes();
  const mix = mixes.find((item) => item.id === req.params.id && item.userId === req.user.id);

  if (!mix) {
    return res.status(404).json({ error: "Mix nao encontrada." });
  }

  mix.playCount += 1;
  mix.updatedAt = new Date().toISOString();

  const history = await getHistory();
  history.push({
    id: nanoid(14),
    userId: req.user.id,
    mixId: mix.id,
    mixName: mix.name,
    playedAt: new Date().toISOString()
  });

  await Promise.all([saveMixes(mixes), saveHistory(history)]);
  return res.status(204).send();
});

mixesRouter.get("/history/list", async (req, res) => {
  const history = await getHistory();
  const recent = history
    .filter((item) => item.userId === req.user.id)
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
    .slice(0, 30);

  return res.json(recent);
});

mixesRouter.post("/:id/share", validateBody(shareSchema), async (req, res) => {
  const mixes = await getMixes();
  const mix = mixes.find((item) => item.id === req.params.id && item.userId === req.user.id);

  if (!mix) {
    return res.status(404).json({ error: "Mix nao encontrada." });
  }

  const expiresInHours = req.validatedBody.expiresInHours || null;
  const expiresAt = expiresInHours
    ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
    : null;

  mix.share = {
    shareId: randomShareId(),
    allowClone: req.validatedBody.allowClone,
    createdAt: new Date().toISOString(),
    expiresAt,
    revokedAt: null,
    accessCount: 0,
    lastAccessAt: null
  };

  mix.updatedAt = new Date().toISOString();

  await saveMixes(mixes);
  await appendAudit("mix.share_created", req, { userId: req.user.id, mixId: mix.id });

  return res.json({
    shareId: mix.share.shareId,
    expiresAt: mix.share.expiresAt,
    allowClone: mix.share.allowClone
  });
});

mixesRouter.post("/:id/share/revoke", async (req, res) => {
  const mixes = await getMixes();
  const mix = mixes.find((item) => item.id === req.params.id && item.userId === req.user.id);

  if (!mix || !mix.share) {
    return res.status(404).json({ error: "Compartilhamento nao encontrado." });
  }

  mix.share.revokedAt = new Date().toISOString();
  mix.updatedAt = new Date().toISOString();

  await saveMixes(mixes);
  await appendAudit("mix.share_revoked", req, { userId: req.user.id, mixId: mix.id });

  return res.status(204).send();
});

mixesRouter.post("/shared/:shareId/clone", async (req, res) => {
  const shareId = String(req.params.shareId || "").trim();
  const mixes = await getMixes();
  const sharedMix = mixes.find((item) => item.share?.shareId === shareId);

  if (!sharedMix || sharedMix.share?.revokedAt) {
    return res.status(404).json({ error: "Compartilhamento nao encontrado." });
  }

  if (sharedMix.share?.expiresAt && Date.now() > new Date(sharedMix.share.expiresAt).getTime()) {
    return res.status(410).json({ error: "Link de compartilhamento expirado." });
  }

  if (!sharedMix.share.allowClone) {
    return res.status(403).json({ error: "Esse compartilhamento e somente leitura." });
  }

  const now = new Date().toISOString();
  const clone = {
    ...toPublicSharedMix(sharedMix),
    id: nanoid(12),
    userId: req.user.id,
    name: `${sharedMix.name} (Importada)`,
    favorite: false,
    source: "shared-clone",
    playCount: 0,
    share: null,
    createdAt: now,
    updatedAt: now
  };

  mixes.push(clone);
  await saveMixes(mixes);

  await appendAudit("mix.shared_cloned", req, { userId: req.user.id, sourceShareId: shareId });
  return res.status(201).json(clone);
});
