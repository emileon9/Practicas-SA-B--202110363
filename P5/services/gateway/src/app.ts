import express from "express";
import cors from "cors";
import { router } from "./routes";
import { authMiddleware } from "./middleware/auth.middleware";
import { env } from "./config/env";
import { metricsMiddleware, registry } from "./observability/metrics";
import { requestLoggingMiddleware } from "./observability/logger";

const app = express();

app.use(cors());
app.use(metricsMiddleware);
app.use(requestLoggingMiddleware);
app.use(authMiddleware);

// /metrics antes del proxy /api: si se montara despues de "/api", una
// peticion real a /api/metrics (si algun microservicio futuro expusiera
// esa ruta) podria chocar por el orden de mounting. Aqui no hay colision
// real hoy, pero es la forma correcta de garantizarlo.
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});

// El proxy hacia los microservicios va ANTES de express.json(): asi el
// body de las peticiones (por ejemplo POST /api/users/graphql) llega
// intacto al microservicio en vez de ser consumido por este Gateway.
app.use("/api", router);

app.use(express.json());
app.get("/health", (_req, res) => {
  // Fallo inducido controlado (ver env.faultInjectRate): con la variable
  // FAULT_INJECT_RATE sin definir (o en 0, el default), esta rama nunca se
  // toma y la respuesta es identica a la de P5/P7.
  if (env.faultInjectRate > 0 && Math.random() < env.faultInjectRate) {
    return res.status(500).json({ status: "error", service: "gateway" });
  }
  res.json({ status: "ok", service: "gateway" });
});

export default app;
