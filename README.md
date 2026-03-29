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
| **Vulnerável** | Tentativas ilimitadas, sem atraso, sem bloqueio        |
| **Protegido**  | Atraso progressivo (Exponential Backoff) até 5 minutos |

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

* Tentativas **ilimitadas**, sem bloqueios.

#### Modo Protegido

* **Atraso progressivo (Exponential Backoff)**: A cada falha de login, a conta do usuário sofre um bloqueio imediato que **dobra** progressivamente (1s, 2s, 4s, 8s...). 
* **Teto máximo**: O tempo de bloqueio contínua dobrando até atingir o limite de **5 minutos** (300.000 ms), impedindo ataques contínuos e mantendo o servidor disponível para demonstrações didáticas da faculdade. Durante o bloqueio, qualquer tentativa de login retorna erro `429 Too Many Requests`.

### Interface Web (`public/index.html`)

Página limpa acessível em `http://localhost:3000` com:

* **Seletor de modo** (Vulnerável / Protegido)
* **Campo para definir a senha** do usuário `admin` (senha que o script de ataque tentará descobrir)
* **Formulário de login** para testes manuais.

### Script de Ataque (`attack.js`)

O script de ataque realiza a força bruta explorando todas as combinações de forma ordenada (A-Z, a-z, 0-9).

Comportamento do ataque:

* **Modo**: Força Bruta Exaustivo (ordem lexicográfica crescente).
* **Progresso**: Começa com 1 caractere, depois 2, depois 3 e assim indefinidamente.
* **Charset**: Alfanumérico completo — `A-Z a-z 0-9` (62 caracteres).
* **Usuário alvo**: `admin`.
* **Tratamento de bloqueios**: Caso o servidor retorne um erro `429 Too Many Requests`, o atacante lê o tempo restante (`remainingBlockMs`) e entra em repouso até estar liberado a atacar novamente.

Exibe em tempo real (no terminal):
* A tentativa atual realizada.
* Resposta HTTP (`200`, `401`, `429`).
* Tempo decorrido.
* Taxa de tentativas por segundo (t/s).

Ao descobrir o valor, logará as estatísticas finais (Total de tentativas, tamanho da senha e tempo gasto).

---

## Estrutura do Repositório

```text
bruteforce-login/
│
├── server.js          # servidor de autenticação (API)
├── attack.js          # script de ataque de força bruta ordenado
├── public/
│   └── index.html     # interface gráfica web
├── package.json       # dependências (express, bcrypt)
└── README.md          # documentação principal
```

---

## Tecnologias

* **Node.js** >= 17.0.0
* **Express.js** e **bcrypt**
* HTML + CSS + JavaScript Vanilla

---

## Como Executar

### 1. Instalar dependências

Abre o terminal na pasta do projeto e execute:

```bash
npm install
```

### 2. Iniciar o servidor

```bash
npm start
```

Acesse `http://localhost:3000` no seu navegador:
1. **Defina a senha** do admin preenchendo o campo de senha.
2. **Escolha o modo do servidor** (Vulnerável ou Protegido).

### 3. Executar o ataque

Abra **outro** terminal na mesma pasta e inicie o script:

```bash
node attack.js
```
*Não é mais necessário informar o tamanho por cli argument.*

---

## Demonstração Esperada

### Cenário 1 — Vulnerável

1. Configure a senha (ex: `Ab`).
2. Mantenha o servidor no modo **Vulnerável**.
3. Inicie `node attack.js`.
4. O ataque executará as requisições rapidamente, exaurirá todo o _charset_ e **encontrará a senha instantaneamente**, testando milhares de combinações por segundo.

### Cenário 2 — Protegido

1. Mude o servidor para o modo **Protegido**.
2. Reinicie ou inicie o ataque: `node attack.js`.
3. Desde a 1ª falha, o servidor responderá com `429 (Too Many Requests)` indicando o atraso, começando em 1 segundo.
4. O atacante lerá os dados e começará a repousar exponencialmente: `1s`, `2s`, `4s`, `8s` e assim por diante, até atingir os bloqueios longos de **5 minutos**.
5. O atacante se torna incapaz de encontrar a senha via força bruta, inviabilizando tentativas numerosas. A demonstração provará matematicamente (com o tempo dobrando) que o descobrimento assíncrono de qualquer código é inviável na prática.

---

## Aviso

Este projeto foi desenvolvido **exclusivamente para fins educacionais**, com o objetivo de demonstrar conceitos de **segurança em sistemas de autenticação**. O uso de técnicas de força bruta em sistemas reais sem autorização é **ilegal e antiético**.
