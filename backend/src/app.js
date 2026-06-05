// Instância principal do Express com middlewares globais de segurança.
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const env = require("./config/env");
const routes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middlewares/error-handler");
const path = require("path");



const app = express();

app.use(express.static(path.join(__dirname, "../../frontend/plataforma")));
app.use("/gestao", express.static(path.join(__dirname, "../../frontend/gestao")));



app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/plataforma/index.html"));
});

app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

app.use(cors({
  origin: function (origin, callback) {

    // permite requisições sem origin (mobile, postman, curl)
    if (!origin) return callback(null, true);

    // libera localhost (dev)
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return callback(null, true);
    }

    console.log("🚫 BLOQUEADO CORS:", origin);

    return callback(null, false);
  },
  credentials: true
}));

app.use(express.json({ limit: "8mb", strict: false }));
app.use(express.urlencoded({ extended: false, limit: "8mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
