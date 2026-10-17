import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || "4000", 10),
  usersServiceUrl: process.env.USERS_SERVICE_URL || "http://localhost:4001",
  productsServiceUrl: process.env.PRODUCTS_SERVICE_URL || "http://localhost:4002",
  ordersServiceUrl: process.env.ORDERS_SERVICE_URL || "http://localhost:4003",
  notificationsServiceUrl: process.env.NOTIFICATIONS_SERVICE_URL || "http://localhost:4004",
  // TODO: URL real del servicio de autenticacion de la Practica 2 (P2/backend).
  authServiceUrl: process.env.AUTH_SERVICE_URL || "",
  // Fallo inducido controlado (Practica 8, demo de rollback automatico de
  // Argo Rollouts): probabilidad (0-1) de que /health responda 500. En
  // 0 (default, no seteado) el comportamiento es identico al de P5/P7.
  faultInjectRate: parseFloat(process.env.FAULT_INJECT_RATE || "0"),
  // Fallo inducido NUEVO (Practica 10, distinto del de P8): en vez de
  // romper /health (una ruta sintetica que el canario ya no consulta --
  // ver analysistemplate.yaml, ahora basado en PromQL sobre trafico
  // real), este retrasa una fraccion del trafico REAL proxied hacia los
  // microservicios (/api/*), para que el AnalysisTemplate lo detecte via
  // p95-latency a partir de metricas reales, no de un ping sintetico. En
  // 0 (default) el comportamiento es identico al normal.
  faultInjectLatencyMs: parseInt(process.env.FAULT_INJECT_LATENCY_MS || "0", 10),
  faultInjectLatencyRate: parseFloat(process.env.FAULT_INJECT_LATENCY_RATE || "0"),
};
