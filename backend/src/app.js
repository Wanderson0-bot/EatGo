// Instância principal do Express com middlewares globais de segurança.
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const env = require("./config/env");
const routes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middlewares/error-handler");

const app = express();


app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [env.APP_ORIGIN, env.FRONTEND_BASE_URL].filter(Boolean);

      if (!origin || allowedOrigins.includes(origin) || origin === "null") {
        callback(null, true);
      } else {
        callback(new Error("CORS origin not allowed"));
      }
    },
    credentials: true
  })
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);
// app.use(
//   rateLimit({
//     windowMs: 15 * 60 * 1000,
//     limit: 300,
//     standardHeaders: true,
//     legacyHeaders: false
//   })
// );
app.use(express.json({ limit: "200kb", strict: false }));
app.use(express.urlencoded({ extended: false, limit: "200kb" }));

app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
