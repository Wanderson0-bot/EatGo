// Script utilitário para gerar hash de senha antes de inserir usuários da gestão no banco.
const { hashPassword } = require("../src/services/password.service");

async function run() {
  const password = process.argv[2];

  if (!password) {
    console.error("Uso: npm run hash:password -- <senha>");
    process.exit(1);
  }

  const hash = await hashPassword(password);
  console.log(hash);
}

run().catch((error) => {
  console.error("Falha ao gerar hash:", error);
  process.exit(1);
});
