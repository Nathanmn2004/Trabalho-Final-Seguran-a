# Como o Hashing Funciona no Código (`server.js`)

Nesta versão do projeto, nós integramos a biblioteca `bcrypt` e adicionamos a chave liga/desliga `USE_HASHING` para demonstrar na prática os efeitos do armazenamento e validação seguros das senhas em um ataque de força bruta.

Abaixo está a explicação exata de onde e como o Hashing atua no seu arquivo `server.js`.

---

## 1. Gravando a Senha (`POST /setup`)

Se o `USE_HASHING` for `true`, o servidor fará isso quando você enviar a senha pelo painel:

```javascript
// Linha 64
adminPasswordHash = await bcrypt.hash(password, 10);
```

**O que está acontecendo aqui:**
* A função `bcrypt.hash()` pega o valor que você enviou (exemplo: `"Ab1"`) e aplica um poderoso algoritmo matemático.
* O número `10` representa o *Salt/Cost Factor* (Custo). Isso instrui o servidor a rodar o algoritmo 2^10 (1024) vezes consecutivas. 
* Em vez de guardar em memória `"Ab1"` (que poderia ser vazada caso o servidor fosse invadido), a variável `adminPasswordHash` recebe um texto embaraçado e irreversível (chamado de *Hash*), parecido com isto:
  `$2b$10$T2Y..hXZnUq8DtzI3hA0I.L...E...R...X...`

---

## 2. Validando as Tentativas do Ataque (`POST /login`)

Quando o `attack.js` manda requisições e a chave `USE_HASHING = true`, a validação do lado do servidor ocorre da seguinte forma:

```javascript
// Linha 140
valid = await bcrypt.compare(password, adminPasswordHash);
```

**O que está acontecendo aqui:**
* Como o sistema não sabe mais a senha original em texto pleno, ele não pode simplesmente checar se `password === adminPassword`.
* Ele pega o palpite do ataque (ex: `"Aa"`), gera o *Hash* matemático dele e tenta comparar com o *Hash* original salvo na memória para descobrir se eles são idênticos matematicamente. Só a função especial do `bcrypt` consegue fazer o cruzamento desses criptogramos reversos com sucesso.

---

## O Impacto Final Contra Força Bruta (A "Magia" do Bcrypt)

No seu servidor sem o `bcrypt` (`USE_HASHING = false`), validar uma senha é algo simples:
> `"Aa"` é igual a `"Ab1"`? Não, a validação ocorre instantaneamente em nanossegundos. A taxa de envio chega facilmente aos **~1400 t/s** (tentativas por segundo) pelo seu script de ataque.

No servidor **com bcrypt** (`USE_HASHING = true`), o algoritmo age como um mecanismo de **Atraso de Computação (Key Stretching)**:
A validação de `compare()` de cada palpite isolado do atacante não é instantânea, porque a matemática da senha não deixa de ser processada 2^10 vezes antes de dizer à CPU se estava errada. Isso prende sua CPU num gargalo que leva quase 100 milissegundos matemáticos por palpite!
O ataque do script é **duramente enfraquecido**, e as taxas médias chegam a cair para no máximo **~10 a ~30 t/s**, antes mesmo de ativar o Exponential Backoff!

### Resumo Didático:
O *Hashing* não só esconde a senha do branco de dados para o caso de vazamentos (*Salting*), mas também consome e força que todas as tentativas de Força Bruta passem por cálculos matemáticos severamente lentos para o processador, protegendo ativamente o software de ser bombardeado de milhares de cliques com facilidade na mesma rapidez original da rede (*Costing/Stretching*).
