const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = 3000;

// Atraso base e atraso máximo (5 minutos) para o modo protegido
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 5 * 60 * 1000;

let mode = "protected";

// Variável para habiliar ou desabilitar o uso do Hash Bcrypt
const USE_HASHING = true;

let adminPasswordHash = null;
let adminPasswordPlain = null;

const attempts = {};

// Retorna os dados de tentativa de um usuário ou cria se não existir
function getAttemptData(username) {
  if (!attempts[username]) {
    attempts[username] = { failedCount: 0, blockedUntil: null };
  }
  return attempts[username];
}

// Verifica se o usuário está bloqueado pelo modo protegido
function isBlocked(ua) {
  return !!ua.blockedUntil && Date.now() < ua.blockedUntil;
}

// Calcula quanto tempo falta para o desbloqueio
function getRemainingBlockMs(ua) {
  return ua.blockedUntil ? Math.max(0, ua.blockedUntil - Date.now()) : 0;
}

// Página principal 
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

//  Status do servidor, indica se senha ja foi definida e modo atual
app.get("/status", (_req, res) => {
  const isSet = USE_HASHING ? adminPasswordHash !== null : adminPasswordPlain !== null;
  res.json({
    passwordSet: isSet,
    mode
  });
});

// Definir senha do admin 
app.post("/setup", async (req, res) => {
  const { password } = req.body;

  // validação básica
  if (typeof password !== "string" || password.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Senha inválida."
    });
  }

  try {
    if (USE_HASHING) {
      adminPasswordHash = await bcrypt.hash(password, 10);
      console.log(`[SETUP] Senha do admin definida — hash gerado com sucesso.`);
    } else {
      adminPasswordPlain = password;
      console.log(`[SETUP] Senha do admin definida em texto plano — ${password.length} caractere${password.length !== 1 ? "s" : ""}.`);
    }

    // limpa histórico de tentativas quando a senha muda
    Object.keys(attempts).forEach((k) => delete attempts[k]);

    return res.json({
      success: true,
      message: "Senha definida."
    });
  } catch (error) {
    console.error("[SETUP] Erro ao configurar senha:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno do servidor ao definir senha."
    });
  }
});

// Possibilidade de alterar o modo do sistema (vulnerável ou protegido)
app.post("/mode", (req, res) => {
  const { newMode } = req.body;

  if (!["vulnerable", "protected"].includes(newMode)) {
    return res.status(400).json({
      success: false,
      message: "Modo inválido."
    });
  }

  mode = newMode;

  // limpa tentativas ao trocar de modo
  Object.keys(attempts).forEach((k) => delete attempts[k]);

  console.log(`[MODE] Modo alterado para: ${mode}`);

  res.json({
    success: true,
    mode
  });
});

// Endpoint de login, recebe usuário e senha e retorna o sucesso ou falha
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // valida os dados enviados
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({
      success: false,
      message: "Envie username e password como texto."
    });
  }

  // verifica se a senha do admin já foi configurada
  const isSet = USE_HASHING ? adminPasswordHash !== null : adminPasswordPlain !== null;
  if (!isSet) {
    return res.status(503).json({
      success: false,
      message: "Senha do admin ainda não foi configurada."
    });
  }

  const ua = getAttemptData(username);

  // se estiver em modo protegido, verifica bloqueio
  if (mode === "protected" && isBlocked(ua)) {
    return res.status(429).json({
      success: false,
      message: "Usuário temporariamente bloqueado.",
      remainingBlockMs: getRemainingBlockMs(ua)
    });
  }

  // valida login
  let valid = false;
  try {
    if (username === "admin") {
      if (USE_HASHING) {
        valid = await bcrypt.compare(password, adminPasswordHash);
      } else {
        valid = password === adminPasswordPlain;
      }
    }
  } catch (error) {
    console.error("[LOGIN] Erro ao comparar senhas:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno do servidor."
    });
  }

  if (!valid) {
    ua.failedCount++;

    // calcula o atraso progressivo (exponential backoff) no modo protegido
    if (mode === "protected") {
      const delayMs = Math.min(BASE_DELAY_MS * Math.pow(2, ua.failedCount - 1), MAX_DELAY_MS);
      ua.blockedUntil = Date.now() + delayMs;

      return res.status(429).json({
        success: false,
        message: `Senha inválida. Usuário bloqueado por ${delayMs / 1000} segundos.`,
        failedCount: ua.failedCount,
        remainingBlockMs: getRemainingBlockMs(ua)
      });
    }

    return res.status(401).json({
      success: false,
      message: "Usuário ou senha inválidos.",
      failedCount: ua.failedCount
    });
  }

  // login bem-sucedido: reset das tentativas
  ua.failedCount = 0;
  ua.blockedUntil = null;

  return res.json({
    success: true,
    message: "Login realizado com sucesso!"
  });
});

// inicia o servidor
app.listen(PORT, () => {
  console.log("---------------------------------------------");
  console.log("   SERVIDOR DE AUTENTICAÇÃO - BRUTE FORCE   ");
  console.log("---------------------------------------------");
  console.log(`URL:  http://localhost:${PORT}`);
  console.log(`Modo: ${mode}`);
  console.log("Aguardando configuração da senha via /setup");
  console.log("---------------------------------------------\n");
});