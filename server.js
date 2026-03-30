const express = require("express");
const path    = require("path");
const bcrypt  = require("bcrypt");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = 3000;

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS  = 5 * 60 * 1000;

// ─────────────────────────────────────────────
// MODO E PROTEÇÕES CONFIGURÁVEIS
// ─────────────────────────────────────────────
let mode = "protected";

// Proteções individuais — só aplicadas no modo protegido
const protections = {
  bcrypt:           true,  // hash bcrypt na comparação de senha
  ipBlocking:       true,  // bloqueio por IP com exponential backoff
  usernameBlocking: true,  // bloqueio por username com exponential backoff
};

// Sempre armazenamos os dois formatos para permitir troca dinâmica
let adminPasswordHash  = null;
let adminPasswordPlain = null;

// ─────────────────────────────────────────────
// ARMAZENAMENTO DE TENTATIVAS
// ─────────────────────────────────────────────
const attemptsByUser = {};
const attemptsByIp   = {};

// ─────────────────────────────────────────────
// MÉTRICAS EM TEMPO REAL
// ─────────────────────────────────────────────
const metrics = {
  totalAttempts:    0,
  blockedAttempts:  0,
  successfulLogins: 0,
  timestamps:       [],
  startedAt:        null,
  foundAt:          null,
};
const snapshots = [];

function recordRequest() {
  const now = Date.now();
  if (!metrics.startedAt) metrics.startedAt = now;
  metrics.timestamps.push(now);
  const cutoff = now - 61000;
  while (metrics.timestamps.length && metrics.timestamps[0] < cutoff) {
    metrics.timestamps.shift();
  }
}

function resetMetrics() {
  metrics.totalAttempts    = 0;
  metrics.blockedAttempts  = 0;
  metrics.successfulLogins = 0;
  metrics.timestamps       = [];
  metrics.startedAt        = null;
  metrics.foundAt          = null;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function getUserAttempt(username) {
  if (!attemptsByUser[username]) {
    attemptsByUser[username] = { failedCount: 0, blockedUntil: null };
  }
  return attemptsByUser[username];
}

function getIpAttempt(ip) {
  if (!attemptsByIp[ip]) {
    attemptsByIp[ip] = { failedCount: 0, blockedUntil: null };
  }
  return attemptsByIp[ip];
}

function isBlocked(entry) {
  return !!entry.blockedUntil && Date.now() < entry.blockedUntil;
}

function getRemainingBlockMs(entry) {
  return entry.blockedUntil ? Math.max(0, entry.blockedUntil - Date.now()) : 0;
}

function calcDelay(failedCount) {
  return Math.min(BASE_DELAY_MS * Math.pow(2, failedCount - 1), MAX_DELAY_MS);
}

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function clearAllAttempts() {
  Object.keys(attemptsByUser).forEach(k => delete attemptsByUser[k]);
  Object.keys(attemptsByIp).forEach(k => delete attemptsByIp[k]);
}

// ─────────────────────────────────────────────
// ROTAS
// ─────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Status do servidor
app.get("/status", (_req, res) => {
  res.json({
    passwordSet: adminPasswordPlain !== null,
    mode,
    protections: { ...protections },
  });
});

// Configuração de proteções
app.get("/config", (_req, res) => {
  res.json({ mode, protections: { ...protections } });
});

app.post("/config", (req, res) => {
  const { bcrypt: bc, ipBlocking, usernameBlocking } = req.body;

  if (typeof bc           === "boolean") protections.bcrypt           = bc;
  if (typeof ipBlocking   === "boolean") protections.ipBlocking       = ipBlocking;
  if (typeof usernameBlocking === "boolean") protections.usernameBlocking = usernameBlocking;

  clearAllAttempts();

  console.log(`[CONFIG] Proteções atualizadas:`, protections);
  res.json({ success: true, protections: { ...protections } });
});

// Definir senha do admin
app.post("/setup", async (req, res) => {
  const { password } = req.body;

  if (typeof password !== "string" || password.length === 0) {
    return res.status(400).json({ success: false, message: "Senha inválida." });
  }

  try {
    // Sempre armazena os dois formatos
    adminPasswordPlain = password;
    adminPasswordHash  = await bcrypt.hash(password, 10);

    clearAllAttempts();

    console.log(`[SETUP] Senha definida — ${password.length} caractere(s), hash bcrypt gerado.`);
    return res.json({ success: true, message: "Senha definida." });
  } catch (error) {
    console.error("[SETUP] Erro:", error);
    return res.status(500).json({ success: false, message: "Erro interno ao definir senha." });
  }
});

// Alterar modo
app.post("/mode", (req, res) => {
  const { newMode } = req.body;

  if (!["vulnerable", "protected"].includes(newMode)) {
    return res.status(400).json({ success: false, message: "Modo inválido." });
  }

  mode = newMode;
  clearAllAttempts();

  console.log(`[MODE] Modo alterado para: ${mode}`);
  res.json({ success: true, mode });
});

// ─────────────────────────────────────────────
// ENDPOINT DE LOGIN
// ─────────────────────────────────────────────
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const clientIp = getClientIp(req);

  metrics.totalAttempts++;
  recordRequest();

  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ success: false, message: "Envie username e password como texto." });
  }

  if (adminPasswordPlain === null) {
    return res.status(503).json({ success: false, message: "Senha do admin ainda não foi configurada." });
  }

  // ── MODO PROTEGIDO: verifica bloqueios ativos ──
  if (mode === "protected") {
    if (protections.ipBlocking) {
      const ia = getIpAttempt(clientIp);
      if (isBlocked(ia)) {
        metrics.blockedAttempts++;
        console.log(`[LOGIN] IP bloqueado: ${clientIp}`);
        return res.status(429).json({
          success: false,
          blockedBy: "ip",
          message: `IP ${clientIp} temporariamente bloqueado.`,
          remainingBlockMs: getRemainingBlockMs(ia)
        });
      }
    }

    if (protections.usernameBlocking) {
      const ua = getUserAttempt(username);
      if (isBlocked(ua)) {
        metrics.blockedAttempts++;
        console.log(`[LOGIN] Username bloqueado: ${username}`);
        return res.status(429).json({
          success: false,
          blockedBy: "username",
          message: `Usuário "${username}" temporariamente bloqueado.`,
          remainingBlockMs: getRemainingBlockMs(ua)
        });
      }
    }
  }

  // ── VALIDA A SENHA ──
  // Modo vulnerável: sempre plaintext (rápido, sem restrição)
  // Modo protegido: usa bcrypt se ativado, senão plaintext
  let valid = false;
  try {
    if (username === "admin") {
      const useBcrypt = mode === "protected" && protections.bcrypt;
      valid = useBcrypt
        ? await bcrypt.compare(password, adminPasswordHash)
        : password === adminPasswordPlain;
    }
  } catch (error) {
    console.error("[LOGIN] Erro ao comparar senhas:", error);
    return res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }

  // ── SENHA ERRADA ──
  if (!valid) {
    // Modo vulnerável: resposta imediata sem qualquer restrição
    if (mode === "vulnerable") {
      return res.status(401).json({ success: false, message: "Usuário ou senha inválidos." });
    }

    // Modo protegido: aplica bloqueios conforme proteções ativas
    const ua = getUserAttempt(username);
    const ia = getIpAttempt(clientIp);

    let remainingBlockMs = 0;

    if (protections.usernameBlocking) {
      ua.failedCount++;
      const userDelay = calcDelay(ua.failedCount);
      ua.blockedUntil = Date.now() + userDelay;
      remainingBlockMs = Math.max(remainingBlockMs, getRemainingBlockMs(ua));
      console.log(`[LOGIN] Falha — user: "${username}" (${ua.failedCount}x, bloqueado ${userDelay / 1000}s)`);
    }

    if (protections.ipBlocking) {
      ia.failedCount++;
      const ipDelay = calcDelay(ia.failedCount);
      ia.blockedUntil = Date.now() + ipDelay;
      remainingBlockMs = Math.max(remainingBlockMs, getRemainingBlockMs(ia));
      console.log(`[LOGIN] Falha — IP: ${clientIp} (${ia.failedCount}x, bloqueado ${calcDelay(ia.failedCount) / 1000}s)`);
    }

    // Se algum bloqueio foi aplicado, retorna 429
    if (remainingBlockMs > 0) {
      metrics.blockedAttempts++;
      return res.status(429).json({
        success: false,
        message: `Senha inválida. Bloqueado por ${Math.ceil(remainingBlockMs / 1000)}s.`,
        blockedBy: "both",
        remainingBlockMs
      });
    }

    // Protegido mas sem bloqueios ativos (ex: só bcrypt ativo)
    return res.status(401).json({ success: false, message: "Usuário ou senha inválidos." });
  }

  // ── LOGIN BEM-SUCEDIDO ──
  const ua = getUserAttempt(username);
  const ia = getIpAttempt(clientIp);
  ua.failedCount = 0; ua.blockedUntil = null;
  ia.failedCount = 0; ia.blockedUntil = null;

  metrics.successfulLogins++;
  if (!metrics.foundAt) metrics.foundAt = Date.now();
  console.log(`[LOGIN] Sucesso — user: "${username}" | IP: ${clientIp}`);

  return res.json({ success: true, message: "Login realizado com sucesso!" });
});

// ─────────────────────────────────────────────
// ROTA DE DEBUG — bloqueios ativos
// ─────────────────────────────────────────────
app.get("/blocks", (_req, res) => {
  const users = Object.entries(attemptsByUser)
    .filter(([, v]) => isBlocked(v))
    .map(([k, v]) => ({
      username: k, failedCount: v.failedCount,
      remainingMs: getRemainingBlockMs(v),
      remainingSeconds: Math.ceil(getRemainingBlockMs(v) / 1000)
    }));

  const ips = Object.entries(attemptsByIp)
    .filter(([, v]) => isBlocked(v))
    .map(([k, v]) => ({
      ip: k, failedCount: v.failedCount,
      remainingMs: getRemainingBlockMs(v),
      remainingSeconds: Math.ceil(getRemainingBlockMs(v) / 1000)
    }));

  res.json({ mode, protections, blockedUsers: users, blockedIps: ips, totalBlocked: users.length + ips.length });
});

// ─────────────────────────────────────────────
// ENDPOINTS DE MÉTRICAS / DASHBOARD
// ─────────────────────────────────────────────

app.get("/metrics", (_req, res) => {
  const now = Date.now();

  const buckets = {};
  for (let i = 59; i >= 0; i--) {
    const key = Math.floor((now - i * 1000) / 1000);
    buckets[key] = 0;
  }
  metrics.timestamps.forEach(t => {
    const key = Math.floor(t / 1000);
    if (key in buckets) buckets[key]++;
  });

  const history    = Object.values(buckets);
  const currentTps = buckets[Math.floor(now / 1000)] || 0;

  const activeUsers = Object.entries(attemptsByUser)
    .filter(([, v]) => isBlocked(v))
    .map(([k, v]) => ({ username: k, remainingSeconds: Math.ceil(getRemainingBlockMs(v) / 1000) }));

  const activeIps = Object.entries(attemptsByIp)
    .filter(([, v]) => isBlocked(v))
    .map(([k, v]) => ({ ip: k, remainingSeconds: Math.ceil(getRemainingBlockMs(v) / 1000) }));

  const elapsedMs = metrics.startedAt ? (metrics.foundAt || now) - metrics.startedAt : 0;
  const finished  = !!metrics.foundAt;

  res.json({
    totalAttempts: metrics.totalAttempts, blockedAttempts: metrics.blockedAttempts,
    successfulLogins: metrics.successfulLogins, currentTps, history, mode,
    protections: { ...protections },
    activeBlocks: { users: activeUsers, ips: activeIps },
    elapsedMs, finished,
  });
});

app.post("/metrics/snapshot", (req, res) => {
  const { label } = req.body;
  const now = Date.now();

  const history = [];
  for (let i = 59; i >= 0; i--) {
    const key = Math.floor((now - i * 1000) / 1000);
    history.push(metrics.timestamps.filter(t => Math.floor(t / 1000) === key).length);
  }
  const nonZero = history.filter(v => v > 0);
  const avgTps  = nonZero.length
    ? Math.round((nonZero.reduce((a, b) => a + b, 0) / nonZero.length) * 10) / 10
    : 0;

  const elapsedMs = metrics.startedAt ? (metrics.foundAt || now) - metrics.startedAt : 0;

  snapshots.push({
    id: Date.now(),
    label: label || `Cenário ${snapshots.length + 1}`,
    mode,
    protections: { ...protections },
    totalAttempts: metrics.totalAttempts,
    blockedAttempts: metrics.blockedAttempts,
    successfulLogins: metrics.successfulLogins,
    avgTps, elapsedMs,
    savedAt: new Date().toLocaleTimeString("pt-BR"),
  });

  res.json({ success: true, snapshot: snapshots[snapshots.length - 1] });
});

app.get("/metrics/snapshots", (_req, res) => { res.json(snapshots); });
app.post("/metrics/reset",    (_req, res) => { resetMetrics(); res.json({ success: true }); });
app.delete("/metrics/snapshots", (_req, res) => { snapshots.length = 0; res.json({ success: true }); });

// Inicia o servidor
app.listen(PORT, () => {
  console.log("---------------------------------------------");
  console.log("   SERVIDOR DE AUTENTICAÇÃO - BRUTE FORCE   ");
  console.log("---------------------------------------------");
  console.log(`URL:  http://localhost:${PORT}`);
  console.log(`Modo: ${mode}`);
  console.log("Aguardando configuração da senha via /setup");
  console.log("---------------------------------------------\n");
});
