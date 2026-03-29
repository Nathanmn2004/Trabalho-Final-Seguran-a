# Brute Force Lab

Laboratório educacional que demonstra ataques de força bruta contra um servidor de autenticação, com suporte a múltiplos atacantes distribuídos via Docker.

---

## Como funciona

O projeto é composto por dois componentes principais:

**Servidor (`server.js`)** — Simula um sistema de login real com dois modos de operação:
- **Modo vulnerável**: Retorna apenas `401` em tentativas erradas, sem nenhuma proteção.
- **Modo protegido**: Aplica bloqueio temporário por IP e por username usando exponential backoff (começa em 1s e pode chegar a 5 minutos).

**Atacantes (`attack.js`)** — Scripts que tentam descobrir a senha do usuário `admin` em três modos:
- **hybrid** (padrão): Testa o dicionário primeiro, depois parte para força bruta.
- **dictionary**: Testa apenas as senhas da wordlist.
- **brute**: Força bruta pura com charset `A-Z a-z 0-9`.

Os atacantes são distribuídos via Docker, cada um com um IP diferente, e dividem o espaço de senhas entre si sem repetição.

---

## Pré-requisitos

- [Docker](https://www.docker.com/) instalado e rodando
- [Docker Compose](https://docs.docker.com/compose/) (já incluso nas versões recentes do Docker)

---

## Como rodar

### 1. Gerar o docker-compose (opcional)

O repositório já inclui um `docker-compose.yml` com 6 atacantes. Se quiser um número diferente, use o gerador:

```bash
node generate-compose.js <numero_de_atacantes> [modo]

# Exemplos:
node generate-compose.js 6 hybrid
node generate-compose.js 10 dictionary
node generate-compose.js 4 brute
```

### 2. Subir o ambiente

```bash
docker compose up --build
```

O servidor vai subir e ficar aguardando a configuração da senha. **Os atacantes só iniciam após a senha ser definida.**

### 3. Configurar a senha e o modo

Acesse **http://localhost:3000** no navegador. A interface permite:

- Definir a senha que os atacantes vão tentar descobrir.
- Escolher o modo do servidor: **Vulnerável** (sem proteção) ou **Protegido** (com bloqueio por IP e username).

Após definir a senha, os atacantes detectam automaticamente que ela foi configurada e começam o ataque.

Alternativamente, via `curl`:

```bash
# Definir a senha
curl -X POST http://localhost:3000/setup \
  -H "Content-Type: application/json" \
  -d '{"password": "suaSenha"}'

# Escolher o modo
curl -X POST http://localhost:3000/mode \
  -H "Content-Type: application/json" \
  -d '{"newMode": "vulnerable"}'
```

### 4. Acompanhar o ataque

Os logs aparecem em tempo real no terminal onde você rodou o `docker compose up`. Cada atacante reporta a senha que está testando, o HTTP status recebido, o tempo decorrido e a taxa de tentativas por segundo.

### 5. Encerrar

```bash
docker compose down
```

---

## Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/setup` | Define a senha do admin |
| `POST` | `/login` | Endpoint de login (alvo do ataque) |
| `POST` | `/mode` | Altera o modo: `vulnerable` ou `protected` |
| `GET` | `/status` | Retorna se a senha foi configurada e o modo atual |
| `GET` | `/blocks` | Lista todos os IPs e usernames bloqueados no momento |

---

## Variáveis de ambiente dos atacantes

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `TOTAL_ATTACKERS` | Total de atacantes no ambiente | `1` |
| `ATTACKER_INDEX` | Índice deste atacante (começa em 0) | `0` |
| `ATTACKER_ID` | ID exibido nos logs | `local` |
| `SERVER_URL` | URL do endpoint de login | `http://localhost:3000/login` |
| `MODE` | Modo do ataque: `hybrid`, `dictionary` ou `brute` | `hybrid` |
| `WORDLIST_PATH` | Caminho para o arquivo de wordlist | `./wordlist.txt` |

---

## Limitações conhecidas

- **Os atacantes não se coordenam entre si.** No modo protegido, todos atacam o mesmo username (`admin`), fazendo o contador de falhas crescer rapidamente e o bloqueio explodir de forma exponencial. Uma solução seria usar um coordenador central (ex: Redis) para sincronizar as esperas.

- **Quando um atacante encontra a senha, os outros continuam.** Sem comunicação entre processos, os demais não sabem que a senha foi descoberta. Basta rodar `docker compose down` para encerrar tudo.

---

## Estrutura do projeto

```
.
├── server.js            # Servidor de autenticação
├── attack.js            # Script de ataque
├── generate-compose.js  # Gerador do docker-compose
├── docker-compose.yml   # Orquestração dos containers
├── Dockerfile           # Imagem dos atacantes
├── wordlist.txt         # Lista de senhas comuns para o modo dicionário
└── public/
    └── index.html       # Interface web para configurar senha e modo
```

---

## Objetivo educacional

Este projeto demonstra na prática:

- Por que senhas curtas são inviáveis (senhas de 3 caracteres são quebradas em minutos).
- Como proteções baseadas apenas em IP são contornadas com múltiplos IPs.
- A diferença de eficácia entre o modo vulnerável e o modo protegido.
- Como o exponential backoff funciona e seus limites.