const express = require("express");

const app = express();
app.use(express.json());

const PORT = 3000;

// Banco simples em memória
const users = [
  {
    username: "admin",
    password: "AB6k" // senha de 4 caracteres para demonstrar
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
  return !!userAttempt.blockedUntil && Date.now() < userAttempt.blockedUntil;
}

function getRemainingBlockTime(userAttempt) {
  if (!userAttempt.blockedUntil) return 0;
  return Math.max(0, userAttempt.blockedUntil - Date.now());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Página inicial
app.get("/", (req, res) => {
  res.json({
    message: "Servidor de login rodando",
    mode,
    demoUser: "admin",
    endpoints: {
      login: "POST /login",
      changeMode: "POST /mode",
      currentMode: "GET /mode",
      status: "GET /status/:username",
      reset: "POST /reset/:username"
    }
  });
});

// Ver modo atual
app.get("/mode", (req, res) => {
  res.json({ mode });
});

// Alterar modo
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
    message: `Modo alterado para ${mode}`,
    mode
  });
});

// Ver status de tentativas do usuário
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

// Resetar tentativas
app.post("/reset/:username", (req, res) => {
  const username = req.params.username;
  attempts[username] = {
    failedCount: 0,
    blockedUntil: null
  };

  res.json({
    success: true,
    message: `Tentativas de '${username}' resetadas com sucesso.`
  });
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({
      success: false,
      message: "Envie username e password como texto."
    });
  }

  const user = users.find((u) => u.username === username);
  const userAttempt = getAttemptData(username);

  if (mode === "protected" && isBlocked(userAttempt)) {
    return res.status(429).json({
      success: false,
      message: "Usuário temporariamente bloqueado.",
      remainingBlockMs: getRemainingBlockTime(userAttempt)
    });
  }

  if (mode === "protected" && userAttempt.failedCount > 0) {
    const delay = userAttempt.failedCount * BASE_DELAY_MS;
    await sleep(delay);
  }

  if (!user || user.password !== password) {
    userAttempt.failedCount += 1;

    if (mode === "protected" && userAttempt.failedCount >= MAX_ATTEMPTS) {
      userAttempt.blockedUntil = Date.now() + BLOCK_TIME_MS;

      return res.status(429).json({
        success: false,
        message: "Muitas tentativas falhas. Usuário bloqueado temporariamente.",
        failedCount: userAttempt.failedCount,
        remainingBlockMs: getRemainingBlockTime(userAttempt)
      });
    }

    return res.status(401).json({
      success: false,
      message: "Usuário ou senha inválidos.",
      failedCount: userAttempt.failedCount
    });
  }

  // Sucesso
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
  console.log(`Usuário de teste: admin`);
  console.log(`Senha de teste: ${users[0].password}`);
});