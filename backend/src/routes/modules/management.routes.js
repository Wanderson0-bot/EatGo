const { Router } = require("express");
const { requireAuth } = require("../../middlewares/auth");
const establishmentRoutes = require("./management/establishment.routes");
const menuRoutes = require("./management/menu.routes");
const ordersRoutes = require("./management/orders.routes");

const router = Router();

router.use(requireAuth);
router.use(establishmentRoutes);
router.use(menuRoutes);
router.use(ordersRoutes);

module.exports = router;
