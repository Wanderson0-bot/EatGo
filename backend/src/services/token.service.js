// Serviço responsável por emitir o token de acesso da gestão.
const jwt = require("jsonwebtoken");
const env = require("../config/env");

function signAccessToken(user) {
  return jwt.sign(
    {
      role: user.papel,
      establishmentId: user.id_estabelecimento
    },
    env.JWT_SECRET,
    {
      subject: String(user.id_usuario_estabelecimento),
      expiresIn: env.JWT_EXPIRES_IN
    }
  );
}

function signPlatformAdminToken() {
  return jwt.sign(
    {
      role: "admin_platform"
    },
    env.JWT_SECRET,
    {
      subject: "admin-platform",
      expiresIn: env.JWT_EXPIRES_IN
    }
  );
}

module.exports = {
  signAccessToken,
  signPlatformAdminToken
};
