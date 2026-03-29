// Gera docker-compose.yml com N atacantes automaticamente
// Uso: node generate-compose.js <numero_de_atacantes> [modo]
// Exemplos:
//   node generate-compose.js 6
//   node generate-compose.js 10 hybrid
//   node generate-compose.js 10 dictionary
//   node generate-compose.js 10 brute

const fs   = require("fs");
const path = require("path");

const N    = parseInt(process.argv[2]);
const MODE = process.argv[3] || "hybrid";

const VALID_MODES = ["hybrid", "dictionary", "brute"];

if (!N || N < 1 || N > 200) {
  console.error("Uso: node generate-compose.js <numero_de_atacantes> [modo]");
  console.error("Exemplo: node generate-compose.js 10 hybrid");
  console.error("Limite: entre 1 e 200 atacantes");
  process.exit(1);
}

if (!VALID_MODES.includes(MODE)) {
  console.error(`Modo inválido: "${MODE}"`);
  console.error(`Modos válidos: ${VALID_MODES.join(", ")}`);
  process.exit(1);
}

function generateAttacker(index, total, mode) {
  const id        = index + 1;
  const lastOctet = 21 + index;

  return `
  # Atacante ${id} de ${total}
  attacker_${id}:
    build: .
    volumes:
      - ./wordlist.txt:/app/wordlist.txt
    environment:
      - TOTAL_ATTACKERS=${total}
      - ATTACKER_INDEX=${index}
      - SERVER_URL=http://172.20.0.10:3000/login
      - ATTACKER_ID=${id}
      - MODE=${mode}
      - WORDLIST_PATH=/app/wordlist.txt
    networks:
      bruteforce_net:
        ipv4_address: 172.20.0.${lastOctet}
    depends_on:
      - server`;
}

const attackers = Array.from({ length: N }, (_, i) => generateAttacker(i, N, MODE)).join("\n");

const compose = `networks:
  bruteforce_net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24

services:
  # Servidor de autenticação
  server:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - ./:/app
    command: sh -c "npm install && node server.js"
    ports:
      - "3000:3000"
    networks:
      bruteforce_net:
        ipv4_address: 172.20.0.10
${attackers}
`;

const outputPath = path.join(__dirname, "docker-compose.yml");
fs.writeFileSync(outputPath, compose, "utf8");

// Nomes dos atacantes para o comando de restart
const attackerNames = Array.from({ length: N }, (_, i) => `attacker_${i + 1}`).join(" ");

console.log(`\n✔ docker-compose.yml gerado com sucesso!`);
console.log(`\nConfiguração:`);
console.log(`  Atacantes:  ${N}`);
console.log(`  Modo:       ${MODE}`);
console.log(`  Servidor:   172.20.0.10:3000`);
console.log(`  IPs:        172.20.0.21 até 172.20.0.${20 + N}`);
console.log(`\nPara subir:`);
console.log(`  docker-compose up --build`);
console.log(`\nPara reiniciar só os atacantes:`);
console.log(`  docker-compose restart ${attackerNames}\n`);