# 🔐 Brute Force em Login e Bloqueio de Tentativas

Projeto acadêmico que demonstra **como ataques de força bruta funcionam em sistemas de login** e como **mecanismos simples de segurança podem mitigá-los**.

O repositório contém um **servidor de autenticação simples** e um **script que simula um ataque automatizado**, permitindo comparar o comportamento **antes e depois da proteção contra brute force**.

---

# 👥 Integrantes

* Vitor Gabriel
* Guilherme Peixoto
* Nathan Nóbrega
* João Pedro Chaves

---

# 📌 Objetivo

Demonstrar, na prática:

1. Como um sistema de login **sem proteção** pode ser explorado por ataques de força bruta.
2. Como **medidas simples de segurança** podem reduzir drasticamente a eficiência desses ataques.

O projeto simula dois cenários:

| Modo           | Descrição                                              |
| -------------- | ------------------------------------------------------ |
| **Vulnerável** | Permite tentativas ilimitadas de login                 |
| **Protegido**  | Limita tentativas e bloqueia o usuário temporariamente |

---

# 🧠 Como o Sistema Funciona

O projeto possui dois componentes principais.

### 1️⃣ Servidor de Login (`server.js`)

Servidor desenvolvido com **Node.js + Express** que:

* recebe requisições de login
* valida usuário e senha
* registra tentativas de acesso
* aplica mecanismos de proteção

Ele pode operar em dois modos:

#### 🔴 Modo Vulnerável

* Permite **tentativas ilimitadas**
* Um atacante pode testar várias senhas rapidamente

#### 🟢 Modo Protegido

O sistema ativa três mecanismos de segurança:

**Limite de tentativas**

* máximo de **5 erros consecutivos**

**Bloqueio temporário**

* usuário bloqueado por **1 minuto**

**Atraso progressivo**

* cada erro aumenta o tempo de resposta

Essas medidas tornam o ataque **muito mais lento e ineficiente**.

---

### 2️⃣ Script de Ataque (`attack.js`)

Arquivo responsável por simular um **ataque de força bruta automatizado**.

Ele:

* tenta várias senhas automaticamente
* envia requisições ao servidor
* verifica se o login foi bem sucedido

Isso permite observar:

* como o sistema se comporta **sem proteção**
* como o ataque é **interrompido quando a mitigação está ativa**

---

# 🏗 Estrutura do Repositório

```
bruteforce-login
│
├── server.js        # servidor de autenticação
├── attack.js        # script de simulação de ataque
├── package.json     # dependências do projeto
└── README.md        # documentação
```

---

# ⚙️ Tecnologias Utilizadas

* **Node.js**
* **Express.js**
* **JavaScript**

---

# 🚀 Como Executar

### 1️⃣ Instalar dependências

```bash
npm install
```

---

### 2️⃣ Iniciar o servidor

```bash
npm start
```

Servidor disponível em:

```
http://localhost:3000
```

---

### 3️⃣ Simular o ataque de força bruta

Abra outro terminal e execute:

```bash
npm run attack
```

O script irá testar várias senhas automaticamente.

---

# 🧪 Demonstração do Experimento

## Cenário 1 — Sistema Vulnerável

O servidor inicia no modo:

```
vulnerable
```

Nesse modo:

* o sistema aceita **tentativas ilimitadas**
* o ataque consegue testar diversas senhas

---

## Cenário 2 — Sistema Protegido

Ao ativar o modo protegido:

```
protected
```

O sistema passa a:

* limitar tentativas
* aplicar atraso progressivo
* bloquear o usuário temporariamente

Resultado:

O ataque é interrompido **antes de descobrir a senha**.

---

# 📊 Conclusão

O experimento mostra que sistemas sem proteção são altamente vulneráveis a ataques de força bruta.

Entretanto, medidas simples como:

* limite de tentativas
* bloqueio temporário
* atraso progressivo

já são suficientes para **reduzir significativamente a eficácia desses ataques**.

---

# ⚠️ Aviso

Este projeto foi desenvolvido **exclusivamente para fins educacionais**, com o objetivo de demonstrar conceitos básicos de **segurança em sistemas de autenticação**.
