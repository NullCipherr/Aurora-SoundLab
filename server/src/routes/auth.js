import { Router } from "express";
import { nanoid } from "nanoid";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  appendAudit,
  authenticate,
  buildMfaSetupSecret,
  buildOtpAuthUrl,
  clearFailedLogin,
  clearSessionCookie,
  createEmailVerificationForUser,
  createPasswordReset,
  createSession,
  consumePasswordResetToken,
  decryptSecret,
  encryptSecret,
  getLoginThrottle,
  hashPassword,
  isSuspiciousLogin,
  markFailedLogin,
  publicUser,
  rememberLoginFingerprint,
  revokeAllUserSessions,
  revokeSessionBySid,
  sanitizeAuthInput,
  setSessionCookie,
  upgradeLegacyPasswordHashIfNeeded,
  validatePasswordPolicy,
  verifyCaptchaIfRequired,
  verifyEmailToken,
  verifyPassword,
  verifyTotp
} from "../auth.js";
import { getUsers, saveUsers } from "../storage.js";

export const authRouter = Router();

const usernameRegex = /^[a-z0-9_.-]{3,32}$/;

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(12).max(160)
});

const loginSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(1).max(160),
  mfaCode: z.string().min(6).max(8).optional(),
  captchaToken: z.string().min(1).optional()
});

const forgotSchema = z.object({
  usernameOrEmail: z.string().min(3).max(128)
});

const resetSchema = z.object({
  token: z.string().min(20).max(256),
  newPassword: z.string().min(12).max(160)
});

const verifyEmailSchema = z.object({
  token: z.string().min(20).max(256)
});

const mfaCodeSchema = z.object({
  code: z.string().min(6).max(8)
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

function genericForgotResponse(res) {
  return res.status(202).json({
    ok: true,
    message: "Se o identificador existir, enviaremos instrucoes de redefinicao."
  });
}

async function issueSession(req, res, user) {
  if (req.cookies?.["aurora.sid"] || req.cookies?.["__Host-aurora.sid"]) {
    await revokeSessionBySid(req.cookies["aurora.sid"] || req.cookies["__Host-aurora.sid"]);
  }

  const { sid, csrfToken } = await createSession(user.id, req);
  setSessionCookie(res, sid);
  return csrfToken;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em alguns minutos." }
});

authRouter.post("/register", validateBody(registerSchema), async (req, res) => {
  const { username, email, password } = sanitizeAuthInput(req.validatedBody);

  if (!usernameRegex.test(username)) {
    return res.status(400).json({ error: "Usuario invalido. Use letras, numeros, ., - e _." });
  }

  const passwordPolicyError = validatePasswordPolicy(password, { username, email });
  if (passwordPolicyError) {
    return res.status(400).json({ error: passwordPolicyError });
  }

  const users = await getUsers();
  if (users.some((user) => user.username === username)) {
    return res.status(409).json({ error: "Usuario ja existe." });
  }

  if (email && users.some((user) => user.email === email)) {
    return res.status(409).json({ error: "Email ja cadastrado." });
  }

  const { hash, algo } = await hashPassword(password);
  const user = {
    id: nanoid(14),
    username,
    email: email || null,
    role: "user",
    passwordHash: hash,
    passwordAlgo: algo,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mfa: {
      enabled: false,
      secret: null,
      pendingSecret: null
    }
  };

  if (email) {
    await createEmailVerificationForUser(user);
  }

  users.push(user);
  await saveUsers(users);

  const csrfToken = await issueSession(req, res, user);

  await appendAudit("auth.register", req, { userId: user.id });

  const payload = {
    user: publicUser(user),
    csrfToken,
    message: "Conta criada com sucesso."
  };

  if (process.env.NODE_ENV !== "production" && user.emailVerification) {
    payload.debugEmailVerificationToken = "Gerado e armazenado com hash. Use endpoint dedicado para envio de email.";
  }

  return res.status(201).json(payload);
});

authRouter.post("/login", loginLimiter, validateBody(loginSchema), async (req, res) => {
  const { username, password, mfaCode } = sanitizeAuthInput(req.validatedBody);

  const throttle = await getLoginThrottle(username, req);
  if (throttle.blocked) {
    return res.status(429).json({
      error: "Muitas tentativas. Aguarde antes de tentar novamente.",
      requiresCaptcha: throttle.requiresCaptcha,
      retryAfterMs: throttle.waitMs
    });
  }

  const captchaOk = await verifyCaptchaIfRequired(req, throttle.requiresCaptcha);
  if (!captchaOk) {
    return res.status(429).json({
      error: "Captcha obrigatorio para continuar.",
      requiresCaptcha: true
    });
  }

  const users = await getUsers();
  const user = users.find((candidate) => candidate.username === username);

  if (!user || !(await verifyPassword(password, user))) {
    const failed = await markFailedLogin(username, req);
    await appendAudit("auth.login_failed", req, { username });

    return res.status(401).json({
      error: "Credenciais invalidas.",
      requiresCaptcha: failed.requiresCaptcha,
      retryAfterMs: failed.waitMs
    });
  }

  if ((user.role || "user") === "admin" && !user.mfa?.enabled) {
    return res.status(403).json({
      error: "Conta admin exige MFA habilitado antes do login."
    });
  }

  if (user.mfa?.enabled) {
    const secret = decryptSecret(user.mfa.secret);
    if (!mfaCode || !secret || !verifyTotp(secret, mfaCode)) {
      await appendAudit("auth.login_mfa_failed", req, { userId: user.id });
      return res.status(401).json({ error: "Codigo MFA invalido.", mfaRequired: true });
    }
  }

  await clearFailedLogin(username, req);
  await upgradeLegacyPasswordHashIfNeeded(user, password, users);

  const suspicious = isSuspiciousLogin(req, user);
  rememberLoginFingerprint(user, req);
  user.updatedAt = new Date().toISOString();
  await saveUsers(users);

  const csrfToken = await issueSession(req, res, user);

  await appendAudit("auth.login_success", req, {
    userId: user.id,
    suspicious
  });

  return res.json({
    user: publicUser(user),
    csrfToken,
    suspiciousLogin: suspicious
  });
});

authRouter.get("/me", authenticate, async (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

authRouter.post("/logout", authenticate, async (req, res) => {
  await revokeSessionBySid(req.sessionId);
  clearSessionCookie(res);
  await appendAudit("auth.logout", req, { userId: req.user.id });
  return res.status(204).send();
});

authRouter.get("/csrf", authenticate, async (req, res) => {
  const csrfToken = await issueSession(req, res, req.user);
  await appendAudit("auth.csrf_rotated", req, { userId: req.user.id });
  return res.json({ csrfToken });
});

authRouter.post("/password/forgot", validateBody(forgotSchema), async (req, res) => {
  const usernameOrEmail = String(req.validatedBody.usernameOrEmail || "").trim().toLowerCase();
  const users = await getUsers();
  const user = users.find(
    (candidate) => candidate.username === usernameOrEmail || candidate.email === usernameOrEmail
  );

  if (!user) {
    await appendAudit("auth.password_forgot_unknown", req, { hasIdentifier: true });
    return genericForgotResponse(res);
  }

  const token = await createPasswordReset(user.id, req);
  await appendAudit("auth.password_forgot", req, { userId: user.id });

  const payload = {
    ok: true,
    message: "Se o identificador existir, enviaremos instrucoes de redefinicao."
  };

  if (process.env.NODE_ENV !== "production") {
    payload.debugResetToken = token;
  }

  return res.status(202).json(payload);
});

authRouter.post("/password/reset", validateBody(resetSchema), async (req, res) => {
  const { token, newPassword } = req.validatedBody;
  const reset = await consumePasswordResetToken(token);

  if (!reset) {
    return res.status(400).json({ error: "Token invalido ou expirado." });
  }

  const users = await getUsers();
  const user = users.find((candidate) => candidate.id === reset.userId);
  if (!user) {
    return res.status(400).json({ error: "Token invalido ou expirado." });
  }

  const policyError = validatePasswordPolicy(newPassword, {
    username: user.username,
    email: user.email || ""
  });
  if (policyError) {
    return res.status(400).json({ error: policyError });
  }

  const { hash, algo } = await hashPassword(newPassword);
  user.passwordHash = hash;
  user.passwordAlgo = algo;
  user.updatedAt = new Date().toISOString();
  delete user.passwordSalt;

  await saveUsers(users);
  await revokeAllUserSessions(user.id);

  await appendAudit("auth.password_reset", req, { userId: user.id });
  return res.status(204).send();
});

authRouter.post("/email/request-verification", authenticate, async (req, res) => {
  if (!req.user.email) {
    return res.status(400).json({ error: "Conta sem email cadastrado." });
  }

  const users = await getUsers();
  const user = users.find((candidate) => candidate.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: "Usuario nao encontrado." });
  }

  const token = await createEmailVerificationForUser(user);
  user.updatedAt = new Date().toISOString();
  await saveUsers(users);

  await appendAudit("auth.email_verification_requested", req, { userId: user.id });

  const payload = { ok: true };
  if (process.env.NODE_ENV !== "production") {
    payload.debugEmailToken = token;
  }

  return res.status(202).json(payload);
});

authRouter.post("/email/verify", validateBody(verifyEmailSchema), async (req, res) => {
  const { token } = req.validatedBody;
  const users = await getUsers();

  const user = users.find((candidate) => verifyEmailToken(candidate, token));
  if (!user) {
    return res.status(400).json({ error: "Token invalido ou expirado." });
  }

  user.emailVerifiedAt = new Date().toISOString();
  user.emailVerification = null;
  user.updatedAt = new Date().toISOString();
  await saveUsers(users);

  await appendAudit("auth.email_verified", req, { userId: user.id });
  return res.status(204).send();
});

authRouter.post("/mfa/setup", authenticate, async (req, res) => {
  const users = await getUsers();
  const user = users.find((candidate) => candidate.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: "Usuario nao encontrado." });
  }

  const secret = buildMfaSetupSecret();
  user.mfa = user.mfa || { enabled: false, secret: null, pendingSecret: null };
  user.mfa.pendingSecret = encryptSecret(secret);
  user.updatedAt = new Date().toISOString();
  await saveUsers(users);

  await appendAudit("auth.mfa_setup_started", req, { userId: user.id });

  return res.json({
    otpauthUrl: buildOtpAuthUrl({ username: user.username, secret })
  });
});

authRouter.post("/mfa/enable", authenticate, validateBody(mfaCodeSchema), async (req, res) => {
  const users = await getUsers();
  const user = users.find((candidate) => candidate.id === req.user.id);
  if (!user?.mfa?.pendingSecret) {
    return res.status(400).json({ error: "Setup de MFA nao iniciado." });
  }

  const pendingSecret = decryptSecret(user.mfa.pendingSecret);
  if (!verifyTotp(pendingSecret, req.validatedBody.code)) {
    return res.status(400).json({ error: "Codigo MFA invalido." });
  }

  user.mfa.enabled = true;
  user.mfa.secret = user.mfa.pendingSecret;
  user.mfa.pendingSecret = null;
  user.updatedAt = new Date().toISOString();

  await saveUsers(users);
  await appendAudit("auth.mfa_enabled", req, { userId: user.id });

  return res.status(204).send();
});

authRouter.post("/mfa/disable", authenticate, validateBody(mfaCodeSchema), async (req, res) => {
  const users = await getUsers();
  const user = users.find((candidate) => candidate.id === req.user.id);
  if (!user?.mfa?.enabled || !user?.mfa?.secret) {
    return res.status(400).json({ error: "MFA nao esta ativo." });
  }

  const secret = decryptSecret(user.mfa.secret);
  if (!verifyTotp(secret, req.validatedBody.code)) {
    return res.status(400).json({ error: "Codigo MFA invalido." });
  }

  user.mfa = { enabled: false, secret: null, pendingSecret: null };
  user.updatedAt = new Date().toISOString();

  await saveUsers(users);
  await appendAudit("auth.mfa_disabled", req, { userId: user.id });

  return res.status(204).send();
});
