// Agrega todas as rotas expostas pela API.
const { Router } = require("express");
const healthRoutes = require("./modules/health.routes");
const authRoutes = require("./modules/auth.routes");
const adminRoutes = require("./modules/admin.routes");
const publicRoutes = require("./modules/public.routes");
const managementRoutes = require("./modules/management.routes");
const orderRoutes = require("./modules/order.routes");
const sessionRoutes = require("./modules/session.routes");

const router = Router();

router.use("/health", healthRoutes);
router.use("/api/auth", authRoutes);
router.use("/api/admin", adminRoutes);
router.use("/api/public", publicRoutes);
router.use("/api/management", managementRoutes);
router.use("/api/orders", orderRoutes);
router.use("/api/session", sessionRoutes);

module.exports = router;
