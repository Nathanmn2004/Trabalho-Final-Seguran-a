const express = require("express");
const path    = require("path");
const bcrypt  = require("bcrypt");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = 3000;

// Atraso base e atraso máximo (5 minutos) para o modo protegido
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS  = 5 * 60 * 1000;

let mode = "protected";

// Variável para habilitar ou desabilitar o uso do Hash Bcrypt
const USE_HASHING = true;

let adminPasswordHash  = null;
let adminPasswordPlain = null;

// ─────────────────────────────────────────────
// ARMAZENAMENTO DE TENTATIVAS
// Duas tabelas separadas: uma por username, outra por IP
// ─────────────────────────────────────────────
const attemptsByUser = {}; // { "admin": { failedCount, blockedUntil } }
const attemptsByIp   = {}; // { "172.20.0.21": { failedCount, blockedUntil } }

// Retorna os dados de tentativa de um username ou cria se não existir
function getUserAttempt(username) {
  if (!attemptsByUser[username]) {
    attemptsByUser[username] = { failedCount: 0, blockedUntil: null };
  }
  return attemptsByUser[username];
}

// Retorna os dados de tentativa de um IP ou cria se não existir
function getIpAttempt(ip) {
  if (!attemptsByIp[ip]) {
    attemptsByIp[ip] = { failedCount: 0, blockedUntil: null };
  }
  return attemptsByIp[ip];
}

// Verifica se uma entrada (user ou IP) está bloqueada
function isBlocked(entry) {
  return !!entry.blockedUntil && Date.now() < entry.blockedUntil;
}

// Calcula quanto tempo falta para o desbloqueio
function getRemainingBlockMs(entry) {
  return entry.blockedUntil ? Math.max(0, entry.blockedUntil - Date.now()) : 0;
}

// Calcula o delay do exponential backoff baseado no número de falhas
function calcDelay(failedCount) {
  return Math.min(BASE_DELAY_MS * Math.pow(2, failedCount - 1), MAX_DELAY_MS);
}

// Extrai o IP real do cliente, considerando proxies
function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

// Limpa todas as tentativas (username e IP)
function clearAllAttempts() {
  Object.keys(attemptsByUser).forEach(k => delete attemptsByUser[k]);
  Object.keys(attemptsByIp).forEach(k => delete attemptsByIp[k]);
}

// ─────────────────────────────────────────────
// ROTAS
// ─────────────────────────────────────────────

// Página principal
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Status do servidor
app.get("/status", (_req, res) => {
  const isSet = USE_HASHING ? adminPasswordHash !== null : adminPasswordPlain !== null;
  res.json({ passwordSet: isSet, mode });
});

// Definir senha do admin
app.post("/setup", async (req, res) => {
  const { password } = req.body;

  if (typeof password !== "string" || password.length === 0) {
    return res.status(400).json({ success: false, message: "Senha inválida." });
  }

  try {
    if (USE_HASHING) {
      adminPasswordHash = await bcrypt.hash(password, 10);
      console.log(`[SETUP] Senha definida — hash bcrypt gerado.`);
    } else {
      adminPasswordPlain = password;
      console.log(`[SETUP] Senha definida em texto plano — ${password.length} caractere(s).`);
    }

    // Limpa todo o histórico de tentativas quando a senha muda
    clearAllAttempts();

    return res.json({ success: true, message: "Senha definida." });
  } catch (error) {
    console.error("[SETUP] Erro:", error);
    return res.status(500).json({ success: false, message: "Erro interno ao definir senha." });
  }
});

// Alterar o modo do sistema (vulnerable ou protected)
app.post("/mode", (req, res) => {
  const { newMode } = req.body;

  if (!["vulnerable", "protected"].includes(newMode)) {
    return res.status(400).json({ success: false, message: "Modo inválido." });
  }

  mode = newMode;

  // Limpa tentativas ao trocar de modo
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

  // Valida os dados enviados
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({
      success: false,
      message: "Envie username e password como texto."
    });
  }

  // Verifica se a senha do admin já foi configurada
  const isSet = USE_HASHING ? adminPasswordHash !== null : adminPasswordPlain !== null;
  if (!isSet) {
    return res.status(503).json({
      success: false,
      message: "Senha do admin ainda não foi configurada."
    });
  }

  // ── MODO PROTEGIDO: verifica bloqueios ──
  if (mode === "protected") {
    const ua = getUserAttempt(username);
    const ia = getIpAttempt(clientIp);

    // Verifica bloqueio por IP primeiro
    if (isBlocked(ia)) {
      console.log(`[LOGIN] IP bloqueado: ${clientIp}`);
      return res.status(429).json({
        success: false,
        blockedBy: "ip",
        message: `IP ${clientIp} temporariamente bloqueado.`,
        remainingBlockMs: getRemainingBlockMs(ia)
      });
    }

    // Verifica bloqueio por username
    if (isBlocked(ua)) {
      console.log(`[LOGIN] Username bloqueado: ${username}`);
      return res.status(429).json({
        success: false,
        blockedBy: "username",
        message: `Usuário "${username}" temporariamente bloqueado.`,
        remainingBlockMs: getRemainingBlockMs(ua)
      });
    }
  }

  // ── VALIDA A SENHA ──
  let valid = false;
  try {
    if (username === "admin") {
      valid = USE_HASHING
        ? await bcrypt.compare(password, adminPasswordHash)
        : password === adminPasswordPlain;
    }
  } catch (error) {
    console.error("[LOGIN] Erro ao comparar senhas:", error);
    return res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }

  // ── SENHA ERRADA ──
  if (!valid) {
    if (mode === "protected") {
      const ua = getUserAttempt(username);
      const ia = getIpAttempt(clientIp);

      // Incrementa falhas e aplica exponential backoff em ambos
      ua.failedCount++;
      ia.failedCount++;

      const userDelay = calcDelay(ua.failedCount);
      const ipDelay   = calcDelay(ia.failedCount);

      ua.blockedUntil = Date.now() + userDelay;
      ia.blockedUntil = Date.now() + ipDelay;

      console.log(
        `[LOGIN] Falha — user: "${username}" (${ua.failedCount}x, bloqueado ${userDelay / 1000}s)` +
        ` | IP: ${clientIp} (${ia.failedCount}x, bloqueado ${ipDelay / 1000}s)`
      );

      // Retorna o maior dos dois tempos de bloqueio para o cliente esperar
      const remainingBlockMs = Math.max(
        getRemainingBlockMs(ua),
        getRemainingBlockMs(ia)
      );

      return res.status(429).json({
        success: false,
        message: `Senha inválida. Bloqueado por ${Math.ceil(remainingBlockMs / 1000)}s.`,
        blockedBy: "both",
        userFailedCount: ua.failedCount,
        ipFailedCount:   ia.failedCount,
        remainingBlockMs
      });
    }

    // Modo vulnerável — só retorna 401 sem bloquear
    const ua = getUserAttempt(username);
    ua.failedCount++;

    return res.status(401).json({
      success: false,
      message: "Usuário ou senha inválidos.",
      failedCount: ua.failedCount
    });
  }

  // ── LOGIN BEM-SUCEDIDO ──
  const ua = getUserAttempt(username);
  const ia = getIpAttempt(clientIp);

  ua.failedCount  = 0;
  ua.blockedUntil = null;
  ia.failedCount  = 0;
  ia.blockedUntil = null;

  console.log(`[LOGIN] Sucesso — user: "${username}" | IP: ${clientIp}`);

  return res.json({ success: true, message: "Login realizado com sucesso!" });
});

// ─────────────────────────────────────────────
// ROTA DE DEBUG — lista todos os bloqueios ativos
// Útil para acompanhar o ataque em tempo real
// ─────────────────────────────────────────────
app.get("/blocks", (_req, res) => {
  const now = Date.now();

  const users = Object.entries(attemptsByUser)
    .filter(([, v]) => isBlocked(v))
    .map(([k, v]) => ({
      username:         k,
      failedCount:      v.failedCount,
      remainingMs:      getRemainingBlockMs(v),
      remainingSeconds: Math.ceil(getRemainingBlockMs(v) / 1000)
    }));

  const ips = Object.entries(attemptsByIp)
    .filter(([, v]) => isBlocked(v))
    .map(([k, v]) => ({
      ip:               k,
      failedCount:      v.failedCount,
      remainingMs:      getRemainingBlockMs(v),
      remainingSeconds: Math.ceil(getRemainingBlockMs(v) / 1000)
    }));

  res.json({
    mode,
    blockedUsers: users,
    blockedIps:   ips,
    totalBlocked: users.length + ips.length
  });
});

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