# Brute Force em Login e Bloqueio de Tentativas

Projeto academico que demonstra **como ataques de forca bruta funcionam em sistemas de login** e como **mecanismos simples de seguranca podem mitiga-los**.

---

## Integrantes

* Vitor Gabriel
* Guilherme Peixoto
* Nathan Nobrega
* Joao Pedro Chaves

---

## Objetivo

Demonstrar, na pratica:

1. Como um sistema de login **sem protecao** pode ser explorado por ataques de forca bruta.
2. Como **medidas simples de seguranca** podem reduzir drasticamente a eficiencia desses ataques.

| Modo           | Descricao                                              |
| -------------- | ------------------------------------------------------ |
| **Vulneravel** | Tentativas ilimitadas, sem atraso, sem bloqueio        |
| **Protegido**  | Atraso progressivo (10s, 20s, ...) + bloqueio de 1min |

---

## Como o Sistema Funciona

### Servidor de Login (`server.js`)

Servidor em **Node.js + Express** que:

* Inicia sem perguntas — configuracao feita pela interface web
* Serve a interface grafica em `http://localhost:3000`
* Aceita requisicoes de login via API REST
* Registra tentativas de acesso por usuario

#### Modo Vulneravel

* Tentativas **ilimitadas**, sem atraso, sem bloqueio

#### Modo Protegido

* **Atraso progressivo**: começa em **10s** na 1a falha, +10s a cada erro subsequente (10s, 20s, 30s...)
* **Bloqueio** apos 5 tentativas falhas: usuario bloqueado por **1 minuto**

### Interface Web (`public/index.html`)

Pagina limpa acessivel em `http://localhost:3000` com:

* **Seletor de modo** (Vulneravel / Protegido)
* **Campo para definir a senha** do usuario `admin` (esta e a senha que o ataque tenta descobrir)
* **Formulario de login** para testes manuais

### Script de Ataque (`attack.js`)

Inicia imediatamente, sem perguntas. Configuracao via argumento CLI:

```bash
node attack.js [comprimento_da_senha]
```

Comportamento fixo:

* **Modo**: aleatorio (sem repeticao de tentativas)
* **Charset**: alfanumerico completo — `A-Z a-z 0-9` (62 caracteres)
* **Usuario alvo**: `admin`

Exibe em tempo real:
* Tentativa atual + resposta HTTP
* Percentual de progresso
* Tempo decorrido
* Taxa de tentativas por segundo

Ao encontrar a senha:
* Senha descoberta
* Total de tentativas
* **Tempo total**
* Taxa media

---

## Estrutura do Repositorio

```
bruteforce-login/
│
├── server.js          # servidor de autenticacao
├── attack.js          # script de ataque de forca bruta
├── public/
│   └── index.html     # interface grafica
├── package.json       # dependencias
└── README.md
```

---

## Tecnologias

* **Node.js** >= 17.0.0
* **Express.js**
* HTML + CSS + JavaScript vanilla

---

## Como Executar

### 1. Instalar dependencias

```bash
npm install
```

### 2. Iniciar o servidor

```bash
npm start
```

Acesse `http://localhost:3000`:
1. **Defina a senha** do admin no campo "Senha do Admin"
2. **Escolha o modo** (Vulneravel ou Protegido)

### 3. Executar o ataque

Em outro terminal, informe o comprimento da senha definida:

```bash
node attack.js 3   # para senha de 3 caracteres
node attack.js 4   # para senha de 4 caracteres (padrao)
```

Ou usando o script npm (usa comprimento 4 por padrao):

```bash
npm run attack
```

---

## Demonstracao

### Cenario 1 — Vulneravel

1. Defina uma senha curta (ex: `B3k`)
2. Mantenha o modo **Vulneravel**
3. Execute `node attack.js 3`
4. O ataque testa livremente e **encontra a senha**

### Cenario 2 — Protegido

1. Mude para o modo **Protegido**
2. Execute o ataque novamente
3. Apos a 1a falha: servidor aplica **10s de atraso**; apos a 2a: **20s**; etc.
4. Apos 5 falhas: **bloqueio de 1 minuto**
5. O ataque e **interrompido** antes de descobrir a senha

### Estimativa de duracao (modo vulneravel, ~80 req/s)

| Charset      | Comprimento | Combinacoes | Tempo medio estimado |
|--------------|-------------|-------------|----------------------|
| Alfanumerico | 1           | 62          | < 1s                 |
| Alfanumerico | 2           | 3.844       | ~24s                 |
| Alfanumerico | 3           | 238.328     | ~25min               |
| Alfanumerico | 4           | 14.776.336  | ~26h                 |

> Para demos rapidas, use senhas de 1 a 2 caracteres.

---

## API do Servidor

| Metodo | Endpoint            | Descricao                                  |
|--------|---------------------|--------------------------------------------|
| GET    | `/mode`             | Retorna o modo atual                       |
| POST   | `/mode`             | Altera o modo `{ "newMode": "..." }`       |
| POST   | `/password`         | Define a senha do admin `{ "password" }`   |
| POST   | `/login`            | Tenta login `{ "username", "password" }`   |
| GET    | `/status/:username` | Status de tentativas do usuario            |
| POST   | `/reset/:username`  | Reseta tentativas do usuario               |

---

## Mudancas da Versao 1

* **Senha configuravel pela interface web**: usuario define a senha diretamente em `http://localhost:3000`, sem alterar codigo ou responder prompts
* **Sem perguntas no terminal**: servidor e atacante iniciam direto
* **Interface limpa**: apenas seletor de modo, definidor de senha e formulario de login
* **Ataque simplificado**: sempre aleatorio, sempre alfanumerico completo, comprimento via argumento CLI
* **Atraso progressivo comeca em 10s**: no modo protegido, o 1o erro ja aplica 10s de espera (antes era 1s)
* **Exibicao de tempo e taxa**: o ataque mostra tempo decorrido e tentativas/segundo em tempo real

---

## Aviso

Este projeto foi desenvolvido **exclusivamente para fins educacionais**, com o objetivo de demonstrar conceitos de **seguranca em sistemas de autenticacao**. O uso de tecnicas de forca bruta em sistemas reais sem autorizacao e **ilegal e antitico**.
