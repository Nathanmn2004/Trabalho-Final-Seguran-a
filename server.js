const express = require("express");

const app = express();
app.use(express.json());

const PORT = 3000;

// "Banco" simples em memória
const users = [
  {
    username: "admin",
    password: "1234"
  }
];

// Controle de tentativas por usuário
const attempts = {};

// Configuração do sistema
let mode = "vulnerable"; // "vulnerable" ou "protected"

const MAX_ATTEMPTS = 5;
const BLOCK_TIME_MS = 60 * 1000; // 1 minuto
const BASE_DELAY_MS = 1000; // atraso progressivo: 1s por erro

function getAttemptData(username) {
  if (!attempts[username]) {
    attempts[username] = {
      failedCount: 0,
      blockedUntil: null
    };
  }
  return attempts[username];
}

function isBlocked(userAttempt) {
  if (!userAttempt.blockedUntil) return false;
  return Date.now() < userAttempt.blockedUntil;
}

function getRemainingBlockTime(userAttempt) {
  if (!userAttempt.blockedUntil) return 0;
  const remaining = userAttempt.blockedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Rota para ver status
app.get("/", (req, res) => {
  res.json({
    message: "Servidor de login rodando",
    mode,
    users: users.map((u) => u.username),
    endpoints: {
      login: "POST /login",
      changeMode: "POST /mode",
      status: "GET /status/:username",
      reset: "POST /reset/:username"
    }
  });
});

// Trocar modo de execução
app.post("/mode", (req, res) => {
  const { newMode } = req.body;

  if (!["vulnerable", "protected"].includes(newMode)) {
    return res.status(400).json({
      success: false,
      message: "Modo inválido. Use 'vulnerable' ou 'protected'."
    });
  }

  mode = newMode;

  res.json({
    success: true,
    message: `Modo alterado para ${mode}`
  });
});

// Ver status de um usuário
app.get("/status/:username", (req, res) => {
  const username = req.params.username;
  const data = getAttemptData(username);

  res.json({
    username,
    failedCount: data.failedCount,
    blocked: isBlocked(data),
    remainingBlockMs: getRemainingBlockTime(data),
    mode
  });
});

// Resetar tentativas de um usuário
app.post("/reset/:username", (req, res) => {
  const username = req.params.username;
  attempts[username] = {
    failedCount: 0,
    blockedUntil: null
  };

  res.json({
    success: true,
    message: `Tentativas do usuário '${username}' foram resetadas.`
  });
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Informe username e password."
    });
  }

  const user = users.find((u) => u.username === username);
  const userAttempt = getAttemptData(username);

  // Se estiver em modo protegido, verifica bloqueio
  if (mode === "protected" && isBlocked(userAttempt)) {
    return res.status(429).json({
      success: false,
      message: "Usuário temporariamente bloqueado por excesso de tentativas.",
      remainingBlockMs: getRemainingBlockTime(userAttempt)
    });
  }

  // Atraso progressivo no modo protegido
  if (mode === "protected" && userAttempt.failedCount > 0) {
    const delay = userAttempt.failedCount * BASE_DELAY_MS;
    await sleep(delay);
  }

  // Usuário inexistente ou senha errada
  if (!user || user.password !== password) {
    userAttempt.failedCount += 1;

    if (mode === "protected" && userAttempt.failedCount >= MAX_ATTEMPTS) {
      userAttempt.blockedUntil = Date.now() + BLOCK_TIME_MS;

      return res.status(429).json({
        success: false,
        message: "Muitas tentativas falhas. Usuário bloqueado temporariamente.",
        failedCount: userAttempt.failedCount,
        blockedUntil: userAttempt.blockedUntil
      });
    }

    return res.status(401).json({
      success: false,
      message: "Usuário ou senha inválidos.",
      failedCount: userAttempt.failedCount
    });
  }

  // Login correto: reseta tentativas
  userAttempt.failedCount = 0;
  userAttempt.blockedUntil = null;

  return res.json({
    success: true,
    message: "Login realizado com sucesso."
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Modo inicial: ${mode}`);
});