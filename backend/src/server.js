// Ponto de entrada do backend.
// Garante que a conexão com o banco esteja válida antes de subir o servidor.
const app = require("./app");
const env = require("./config/env");
const { testConnection } = require("./config/database");

async function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`EatGo backend ativo na porta ${port}`);
      resolve(server);
    });

    server.on("error", (error) => {
      reject(error);
    });
  });
}

async function start() {
  await testConnection();

  let port = env.PORT;
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await startServer(port);
      return;
    } catch (error) {
      if (error.code === "EADDRINUSE") {
        console.warn(`Porta ${port} já está em uso. Tentando porta ${port + 1}...`);
        port += 1;
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `Não foi possível iniciar o backend. Todas as portas de ${env.PORT} a ${port} estão ocupadas.`
  );
}

start().catch((error) => {
  console.error("Falha ao iniciar o backend:", error);
  process.exit(1);
});
