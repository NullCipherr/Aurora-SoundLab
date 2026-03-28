import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import { nanoid } from "nanoid";
import {
  getAuthAuditLog,
  getLoginAttempts,
  getPasswordResets,
  getSessions,
  getUsers,
  saveAuthAuditLog,
  saveLoginAttempts,
  savePasswordResets,
  saveSessions,
  saveUsers
} from "./storage.js";

const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-aurora.sid" : "aurora.sid";
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24);
const SESSION_IDLE_TTL_MS = Number(process.env.SESSION_IDLE_TTL_MS || 1000 * 60 * 60 * 2);
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
const RESET_TOKEN_TTL_MS = Number(process.env.RESET_TOKEN_TTL_MS || 1000 * 60 * 15);
const EMAIL_TOKEN_TTL_MS = Number(process.env.EMAIL_TOKEN_TTL_MS || 1000 * 60 * 30);
const AUDIT_LOG_LIMIT = Number(process.env.AUDIT_LOG_LIMIT || 2000);

const commonWeakPasswords = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password123",
  "qwerty123",
  "admin123",
  "letmein",
  "welcome123",
  "iloveyou"
]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// Tokens aleatorios usados para sessao, CSRF e fluxos temporarios.
function randomToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function nowIso() {
  return new Date().toISOString();
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function sanitizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function cookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS
  };
}

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email || null,
    role: user.role || "user",
    emailVerified: Boolean(user.emailVerifiedAt),
    mfaEnabled: Boolean(user.mfa?.enabled)
  };
}

export function validatePasswordPolicy(password, { username = "", email = "" } = {}) {
  const pwd = String(password || "");
  const normalized = pwd.toLowerCase();

  if (pwd.length < 12) {
    return "Senha fraca: minimo de 12 caracteres.";
  }
  if (!/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/\d/.test(pwd)) {
    return "Senha fraca: use maiuscula, minuscula e numero.";
  }
  if (commonWeakPasswords.has(normalized)) {
    return "Senha fraca: escolha uma senha menos previsivel.";
  }

  const usernamePart = sanitizeUsername(username);
  if (usernamePart && normalized.includes(usernamePart)) {
    return "Senha fraca: nao inclua seu usuario na senha.";
  }

  const emailPart = sanitizeEmail(email).split("@")[0];
  if (emailPart && emailPart.length >= 3 && normalized.includes(emailPart)) {
    return "Senha fraca: nao inclua partes do email na senha.";
  }

  return null;
}

export async function hashPassword(password) {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return { hash, algo: "bcrypt" };
}

export async function verifyPassword(password, user) {
  // Mantem compatibilidade com hash legado enquanto migra gradualmente para bcrypt.
  if (user.passwordHash?.startsWith("$2")) {
    return bcrypt.compare(password, user.passwordHash);
  }

  if (user.passwordSalt && user.passwordHash) {
    const check = crypto.scryptSync(password, user.passwordSalt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(check, "hex"), Buffer.from(user.passwordHash, "hex"));
  }

  return false;
}

export async function upgradeLegacyPasswordHashIfNeeded(user, plainPassword, users) {
  if (!user.passwordSalt && user.passwordHash?.startsWith("$2")) {
    return;
  }

  const { hash, algo } = await hashPassword(plainPassword);
  user.passwordHash = hash;
  user.passwordAlgo = algo;
  delete user.passwordSalt;
  await saveUsers(users);
}

export async function appendAudit(event, req, metadata = {}) {
  const entries = await getAuthAuditLog();
  entries.push({
    id: nanoid(14),
    event,
    ipHash: sha256(getClientIp(req)),
    userAgentHash: sha256(String(req.headers["user-agent"] || "unknown")),
    at: nowIso(),
    ...metadata
  });

  const compact = entries.slice(-AUDIT_LOG_LIMIT);
  await saveAuthAuditLog(compact);
}

function attemptsKey(username, req) {
  return `${sanitizeUsername(username)}::${sha256(getClientIp(req))}`;
}

export async function getLoginThrottle(username, req) {
  const attempts = await getLoginAttempts();
  const key = attemptsKey(username, req);
  const record = attempts[key];

  if (!record) {
    return { blocked: false, requiresCaptcha: false, waitMs: 0 };
  }

  const now = Date.now();
  const waitMs = Math.max(0, Number(record.nextAllowedAt || 0) - now);
  const blocked = waitMs > 0;
  const requiresCaptcha = Number(record.count || 0) >= 5;

  return { blocked, requiresCaptcha, waitMs };
}

export async function markFailedLogin(username, req) {
  const attempts = await getLoginAttempts();
  const key = attemptsKey(username, req);
  const current = attempts[key] || { count: 0, nextAllowedAt: 0 };
  const now = Date.now();

  const nextCount = Number(current.count || 0) + 1;
  // Backoff exponencial com teto para reduzir brute force sem bloquear permanentemente.
  const penaltyMs = Math.min(1000 * 60 * 15, 1000 * 2 ** Math.min(nextCount, 12));

  attempts[key] = {
    count: nextCount,
    nextAllowedAt: now + penaltyMs,
    updatedAt: nowIso()
  };

  await saveLoginAttempts(attempts);

  return {
    waitMs: penaltyMs,
    requiresCaptcha: nextCount >= 5
  };
}

export async function clearFailedLogin(username, req) {
  const attempts = await getLoginAttempts();
  const key = attemptsKey(username, req);
  if (attempts[key]) {
    delete attempts[key];
    await saveLoginAttempts(attempts);
  }
}

export async function verifyCaptchaIfRequired(req, required) {
  if (!required) {
    return true;
  }

  const token = String(req.body?.captchaToken || "").trim();
  if (!token) {
    return false;
  }

  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) {
    // Bypass controlado apenas em ambiente nao produtivo.
    return process.env.NODE_ENV !== "production" && token === "dev-bypass-captcha";
  }

  try {
    const response = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: getClientIp(req)
      })
    });

    const result = await response.json();
    return Boolean(result.success);
  } catch {
    return false;
  }
}

export async function createSession(userId, req) {
  const sessions = await getSessions();
  const sid = randomToken(40);
  const csrfToken = randomToken(24);
  const sidHash = sha256(sid);
  const now = Date.now();

  sessions[sidHash] = {
    userId,
    csrfHash: sha256(csrfToken),
    createdAt: new Date(now).toISOString(),
    lastActivityAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    ipHash: sha256(getClientIp(req)),
    userAgentHash: sha256(String(req.headers["user-agent"] || "unknown"))
  };

  await saveSessions(sessions);
  return { sid, csrfToken };
}

export async function revokeSessionBySid(sid) {
  if (!sid) {
    return;
  }

  const sidHash = sha256(sid);
  const sessions = await getSessions();
  if (sessions[sidHash]) {
    delete sessions[sidHash];
    await saveSessions(sessions);
  }
}

export async function revokeAllUserSessions(userId) {
  const sessions = await getSessions();
  let changed = false;

  for (const [key, session] of Object.entries(sessions)) {
    if (session.userId === userId) {
      changed = true;
      delete sessions[key];
    }
  }

  if (changed) {
    await saveSessions(sessions);
  }
}

export function setSessionCookie(res, sid) {
  res.cookie(SESSION_COOKIE, sid, cookieOptions());
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    ...cookieOptions(),
    maxAge: undefined
  });
}

function extractSid(req) {
  return String(req.cookies?.[SESSION_COOKIE] || "");
}

export async function authenticate(req, res, next) {
  const sid = extractSid(req);
  if (!sid) {
    return res.status(401).json({ error: "Nao autenticado." });
  }

  const [sessions, users] = await Promise.all([getSessions(), getUsers()]);
  const sidHash = sha256(sid);
  const session = sessions[sidHash];
  if (!session) {
    return res.status(401).json({ error: "Sessao invalida." });
  }

  const now = Date.now();
  const expiresAt = new Date(session.expiresAt).getTime();
  const lastActivityAt = new Date(session.lastActivityAt).getTime();

  if (Number.isNaN(expiresAt) || now > expiresAt || now - lastActivityAt > SESSION_IDLE_TTL_MS) {
    delete sessions[sidHash];
    await saveSessions(sessions);
    clearSessionCookie(res);
    return res.status(401).json({ error: "Sessao expirada. Faca login novamente." });
  }

  const user = users.find((candidate) => candidate.id === session.userId);
  if (!user) {
    delete sessions[sidHash];
    await saveSessions(sessions);
    clearSessionCookie(res);
    return res.status(401).json({ error: "Sessao invalida." });
  }

  session.lastActivityAt = nowIso();
  await saveSessions(sessions);

  req.sessionId = sid;
  req.sessionIdHash = sidHash;
  req.session = session;
  req.user = user;
  return next();
}

export async function requireCsrf(req, res, next) {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return next();
  }

  const sid = extractSid(req);
  if (!sid) {
    return res.status(401).json({ error: "Nao autenticado." });
  }

  const sessions = await getSessions();
  const session = sessions[sha256(sid)];
  if (!session) {
    return res.status(401).json({ error: "Sessao invalida." });
  }

  const csrf = String(req.headers["x-csrf-token"] || req.body?.csrfToken || "").trim();
  if (!csrf) {
    return res.status(403).json({ error: "CSRF token ausente." });
  }

  const valid = crypto.timingSafeEqual(Buffer.from(sha256(csrf), "hex"), Buffer.from(session.csrfHash, "hex"));
  if (!valid) {
    return res.status(403).json({ error: "CSRF token invalido." });
  }

  return next();
}

export async function rotateCsrfForCurrentSession(req) {
  const sidHash = req.sessionIdHash;
  if (!sidHash) {
    return null;
  }

  const sessions = await getSessions();
  const session = sessions[sidHash];
  if (!session) {
    return null;
  }

  const csrfToken = randomToken(24);
  session.csrfHash = sha256(csrfToken);
  session.lastActivityAt = nowIso();
  await saveSessions(sessions);

  return csrfToken;
}

export function buildMfaSetupSecret() {
  return speakeasy.generateSecret({ length: 20 }).base32;
}

export function buildOtpAuthUrl({ username, secret }) {
  return speakeasy.otpauthURL({
    secret,
    label: username,
    issuer: "Aurora SoundLab",
    encoding: "base32"
  });
}

export function verifyTotp(secret, code) {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: String(code || ""),
    window: 1
  });
}

function mfaSecretKey() {
  // Deriva chave fixa do ambiente; em producao deve vir de segredo forte e rotacionavel.
  const secret = process.env.MFA_SECRET_KEY || "";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain) {
  const key = mfaSecretKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    value: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64")
  };
}

export function decryptSecret(payload) {
  if (!payload?.value || !payload?.iv || !payload?.tag) {
    return "";
  }

  const key = mfaSecretKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.value, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf-8");
}

export async function createPasswordReset(userId, req) {
  const token = randomToken(40);
  const resets = await getPasswordResets();
  resets.push({
    id: nanoid(12),
    userId,
    tokenHash: sha256(token),
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
    usedAt: null,
    requestedIpHash: sha256(getClientIp(req))
  });

  await savePasswordResets(resets.slice(-5000));
  return token;
}

export async function consumePasswordResetToken(token) {
  const tokenHash = sha256(String(token || ""));
  const resets = await getPasswordResets();
  const reset = resets.find((item) => item.tokenHash === tokenHash);
  if (!reset || reset.usedAt) {
    return null;
  }

  if (Date.now() > new Date(reset.expiresAt).getTime()) {
    return null;
  }

  reset.usedAt = nowIso();
  await savePasswordResets(resets);
  return reset;
}

export async function createEmailVerificationForUser(user) {
  const token = randomToken(32);
  user.emailVerification = {
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS).toISOString(),
    requestedAt: nowIso()
  };
  return token;
}

export function verifyEmailToken(user, token) {
  if (!user.emailVerification?.tokenHash || !user.emailVerification?.expiresAt) {
    return false;
  }

  if (Date.now() > new Date(user.emailVerification.expiresAt).getTime()) {
    return false;
  }

  return user.emailVerification.tokenHash === sha256(String(token || ""));
}

export function isSuspiciousLogin(req, user) {
  // Heuristica simples baseada em mudanca de IP e User-Agent.
  if (!user.lastIpHash || !user.lastUserAgentHash) {
    return false;
  }

  const ipChanged = user.lastIpHash !== sha256(getClientIp(req));
  const agentChanged = user.lastUserAgentHash !== sha256(String(req.headers["user-agent"] || "unknown"));
  return ipChanged || agentChanged;
}

export function rememberLoginFingerprint(user, req) {
  user.lastIpHash = sha256(getClientIp(req));
  user.lastUserAgentHash = sha256(String(req.headers["user-agent"] || "unknown"));
  user.lastLoginAt = nowIso();
}

export function sanitizeAuthInput(input) {
  return {
    username: sanitizeUsername(input.username),
    email: sanitizeEmail(input.email),
    password: String(input.password || ""),
    mfaCode: String(input.mfaCode || "").trim()
  };
}
