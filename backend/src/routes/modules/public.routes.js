const { Router } = require("express");
const platformConfigRoutes = require("./public/platform-config.routes");
const establishmentsRoutes = require("./public/establishments.routes");
const clientsRoutes = require("./public/clients.routes");

const router = Router();

router.use(platformConfigRoutes);
router.use(establishmentsRoutes);
router.use(clientsRoutes);

module.exports = router;
