# Brute Force em Login e Bloqueio de Tentativas

Projeto acadêmico que demonstra **como ataques de força bruta funcionam em sistemas de login** e como **mecanismos simples de segurança podem mitigá-los**.

---

## Integrantes

* Vitor Gabriel
* Guilherme Peixoto
* Nathan Nóbrega
* João Pedro Chaves

---

## Objetivo

Demonstrar, na prática:

1. Como um sistema de login **sem proteção** pode ser explorado por ataques de força bruta exaustivos.
2. Como **medidas de segurança** (como limite de tentativas e hashing de senhas) garantem a robustez da autenticação.

| Modo           | Descrição                                              |
| -------------- | ------------------------------------------------------ |
| **Vulnerável** | Sem proteção alguma — plaintext, sem bloqueios, resposta instantânea |
| **Protegido**  | Proteções configuráveis: bcrypt, bloqueio por IP e bloqueio por username |

---

## Como o Sistema Funciona

### Servidor de Login (`server.js`)

Servidor em **Node.js + Express** que:

* Inicia sem configuração prévia da senha (feita via interface web)
* Serve a interface gráfica em `http://localhost:3000`
* **Armazena senhas com segurança:** Utiliza o algoritmo `bcrypt` para gerar e validar o respectivo _hash_ da senha do administrador.
* Aceita requisições de configuração (`/setup`) e login (`/login`) via API REST.
* Protege contra ataques mantendo um registro de falhas por usuário em memória.

#### Modo Vulnerável

* Comparação de senha em **texto plano** — sem bcrypt, resposta instantânea.
* Tentativas **ilimitadas**, sem bloqueios de qualquer tipo.

#### Modo Protegido

Permite ativar individualmente cada proteção:

* **Hash bcrypt:** cada verificação leva ~100ms, reduzindo a taxa de ataque de centenas para ~10 t/s.
* **Bloqueio por IP:** atraso progressivo (Exponential Backoff) a cada falha — 1s, 2s, 4s, 8s... até 5 minutos. Eficaz contra um único atacante.
* **Bloqueio por username:** mesmo backoff aplicado ao usuário `admin`, independente do IP. Eficaz mesmo contra ataques distribuídos com múltiplos IPs.

Durante o bloqueio, qualquer tentativa de login retorna erro `429 Too Many Requests`.

### Interface Web (`public/index.html`)

Página limpa acessível em `http://localhost:3000` com:

* **Seletor de modo** (Vulnerável / Protegido)
* **Painel de proteções** (visível no modo protegido): checkboxes para ativar/desativar bcrypt, bloqueio por IP e bloqueio por username individualmente
* **Campo para definir a senha** do usuário `admin` (senha que o script de ataque tentará descobrir)
* **Botão de acesso ao dashboard** de monitoramento

### Dashboard (`public/dashboard.html`)

Acessível em `http://localhost:3000/dashboard.html`. Possui duas abas:

* **Tempo Real:** gráfico de t/s nos últimos 60s, contadores de tentativas/bloqueios, cronômetro de execução e lista de IPs/usernames bloqueados.
* **Comparativo:** salva snapshots de cada cenário e exibe gráficos de barras comparando total de tentativas, bloqueios, taxa média e tempo para descobrir a senha.

### Script de Ataque (`attack.js`)

O script de ataque realiza a força bruta explorando todas as combinações de forma ordenada (A-Z, a-z, 0-9), com duas fases:

* **Fase 1 — Dicionário:** testa as 118 senhas mais comuns do `wordlist.txt`.
* **Fase 2 — Força Bruta:** percorre todas as combinações alfanuméricas em ordem crescente.

Comportamento do ataque:

* **Modo**: Híbrido por padrão (dicionário primeiro, depois força bruta).
* **Progresso**: Começa com 1 caractere, depois 2, depois 3 e assim indefinidamente.
* **Charset**: Alfanumérico completo — `A-Z a-z 0-9` (62 caracteres).
* **Usuário alvo**: `admin`.
* **Tratamento de bloqueios**: Caso o servidor retorne um erro `429 Too Many Requests`, o atacante lê o tempo restante (`remainingBlockMs`) e entra em repouso até estar liberado a atacar novamente.

Exibe em tempo real (no terminal):
* A tentativa atual realizada.
* Resposta HTTP (`200`, `401`, `429`).
* Tempo decorrido.
* Taxa de tentativas por segundo (t/s).

Ao descobrir a senha, exibe as estatísticas finais (total de tentativas, tamanho da senha e tempo gasto).

---

## Estrutura do Repositório

```text
Trabalho-Final-Segurança/
│
├── server.js                  # servidor de autenticação com proteções configuráveis
├── attack.js                  # script de ataque distribuído (força bruta + dicionário)
├── docker-compose.yml         # sobe servidor + 20 atacantes (rede interna)
├── docker-compose.attack.yml  # sobe apenas os 20 atacantes (aponta para URL externa)
├── Dockerfile                 # imagem dos containers atacantes
├── start-attack.sh            # script interativo para disparar o ataque distribuído
├── wordlist.txt               # lista de 118 senhas comuns (fase de dicionário)
├── public/
│   ├── index.html             # interface de controle do servidor
│   └── dashboard.html         # dashboard de monitoramento e comparativo
└── package.json               # dependências (express, bcrypt)
```

---

## Tecnologias

* **Node.js** >= 17.0.0
* **Express.js** e **bcrypt**
* **Docker** e **Docker Compose**
* **ngrok** (opcional, para exposição do servidor na internet)
* HTML + CSS + JavaScript Vanilla + Chart.js

---

## Como Executar

### 1. Instalar dependências

```bash
npm install
```

### 2. Iniciar o servidor

```bash
npm start
```

### 3. Abrir o túnel ngrok (opcional — para ataque de outra máquina)

Em outro terminal:

```bash
ngrok http 3000
```

O ngrok exibirá uma URL pública. Copie-a — será usada pelo script de ataque.

### 4. Configurar o servidor

Acesse `http://localhost:3000`:
1. **Defina a senha** do admin.
2. **Escolha o modo** (Vulnerável ou Protegido).
3. Se protegido, **selecione as proteções** desejadas e clique em **Aplicar**.

### 5. Disparar o ataque com 20 bots

Em outro terminal:

```bash
./start-attack.sh
```

O script pergunta se o alvo é **localhost** ou **ngrok**. Se ngrok, solicita a URL. Os 20 containers são disparados automaticamente em paralelo.

---

## Demonstração Esperada

### Cenário 1 — Vulnerável

1. Configure a senha (ex: `Ab`).
2. Mantenha o servidor no modo **Vulnerável**.
3. Inicie `./start-attack.sh` → opção localhost.
4. O ataque executará centenas de requisições por segundo e **encontrará a senha em segundos**.

### Cenário 2 — Protegido (todas as proteções)

1. Mude o servidor para o modo **Protegido** com bcrypt + bloqueio por IP + bloqueio por username.
2. Inicie `./start-attack.sh`.
3. Desde a 1ª falha, o servidor responderá com `429 (Too Many Requests)`.
4. O atacante aguardará exponencialmente: `1s`, `2s`, `4s`, `8s`... até 5 minutos.
5. O tempo para descobrir a senha se torna inviável na prática.

### Cenário 3 — Protegido só com bloqueio por IP

1. Ative apenas **Bloqueio por IP** (desative bcrypt e bloqueio por username).
2. Inicie `./start-attack.sh`.
3. Cada bot tem um IP diferente — cada IP tem seu próprio contador zerado — o bloqueio por IP **não resiste** ao ataque distribuído.

### Cenário 4 — Protegido só com bloqueio por username

1. Ative apenas **Bloqueio por username**.
2. Inicie `./start-attack.sh`.
3. Todos os bots atacam o mesmo usuário `admin` — o bloqueio por username **resiste** ao ataque distribuído, independente do número de IPs.

---

## Executando o Ataque pela Internet com Ngrok

É possível expor o servidor localmente para a internet usando o **ngrok**, permitindo que o atacante rode o script de outra máquina ou rede.

### 1. Instalar o ngrok

```bash
brew install ngrok
```

### 2. Criar conta e autenticar

Crie uma conta gratuita em [ngrok.com](https://ngrok.com) e autentique:

```bash
ngrok config add-authtoken SEU_TOKEN_AQUI
```

### 3. Subir o servidor normalmente

```bash
npm start
```

### 4. Abrir o túnel (em outro terminal)

```bash
ngrok http 3000
```

O ngrok exibirá uma URL pública, por exemplo:

```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

### 5. Enviar a URL para o atacante

Copie a URL gerada e envie para a outra máquina (via WhatsApp, Discord, etc.). Na máquina atacante, basta ter Node.js instalado e rodar:

```bash
SERVER_URL=https://abc123.ngrok-free.app/login node attack.js
```

> **Observação:** No plano gratuito do ngrok, a URL muda a cada vez que o túnel é reiniciado. Basta repassar a nova URL ao atacante. Se desejar uma URL fixa, o ngrok oferece um domínio estático gratuito configurável no dashboard.

---

## Aviso

Este projeto foi desenvolvido **exclusivamente para fins educacionais**, com o objetivo de demonstrar conceitos de **segurança em sistemas de autenticação**. O uso de técnicas de força bruta em sistemas reais sem autorização é **ilegal e antiético**.
