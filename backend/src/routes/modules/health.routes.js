// Rota simples de healthcheck para validar disponibilidade da API.
const { Router } = require("express");

const router = Router();

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "eatgo-backend"
  });
});

module.exports = router;
