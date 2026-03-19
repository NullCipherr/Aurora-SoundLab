import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");

const paths = {
  users: path.join(dataDir, "users.json"),
  sessions: path.join(dataDir, "sessions.json"),
  mixes: path.join(dataDir, "mixes.json"),
  history: path.join(dataDir, "history.json"),
  loginAttempts: path.join(dataDir, "login-attempts.json"),
  passwordResets: path.join(dataDir, "password-resets.json"),
  authAudit: path.join(dataDir, "auth-audit.json")
};

const defaults = {
  users: [],
  sessions: {},
  mixes: [],
  history: [],
  loginAttempts: {},
  passwordResets: [],
  authAudit: []
};

const writeQueues = new Map();

async function ensureFile(filePath, initialData) {
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(initialData, null, 2), {
      encoding: "utf-8",
      mode: 0o600
    });
  }
}

async function readJson(filePath, fallback) {
  await ensureFile(filePath, fallback);
  const raw = await fs.readFile(filePath, "utf-8");

  try {
    return JSON.parse(raw);
  } catch {
    await writeJson(filePath, fallback);
    return structuredClone(fallback);
  }
}

function writeJson(filePath, data) {
  const prior = writeQueues.get(filePath) || Promise.resolve();

  const next = prior.then(async () => {
    await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });

    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    const payload = JSON.stringify(data, null, 2);

    await fs.writeFile(tempPath, payload, { encoding: "utf-8", mode: 0o600 });
    await fs.rename(tempPath, filePath);
    await fs.chmod(filePath, 0o600);
  });

  writeQueues.set(filePath, next.catch(() => {}));
  return next;
}

export function getUsers() {
  return readJson(paths.users, defaults.users);
}

export function saveUsers(users) {
  return writeJson(paths.users, users);
}

export function getSessions() {
  return readJson(paths.sessions, defaults.sessions);
}

export function saveSessions(sessions) {
  return writeJson(paths.sessions, sessions);
}

export function getMixes() {
  return readJson(paths.mixes, defaults.mixes);
}

export function saveMixes(mixes) {
  return writeJson(paths.mixes, mixes);
}

export function getHistory() {
  return readJson(paths.history, defaults.history);
}

export function saveHistory(history) {
  return writeJson(paths.history, history);
}

export function getLoginAttempts() {
  return readJson(paths.loginAttempts, defaults.loginAttempts);
}

export function saveLoginAttempts(attempts) {
  return writeJson(paths.loginAttempts, attempts);
}

export function getPasswordResets() {
  return readJson(paths.passwordResets, defaults.passwordResets);
}

export function savePasswordResets(resets) {
  return writeJson(paths.passwordResets, resets);
}

export function getAuthAuditLog() {
  return readJson(paths.authAudit, defaults.authAudit);
}

export function saveAuthAuditLog(entries) {
  return writeJson(paths.authAudit, entries);
}
