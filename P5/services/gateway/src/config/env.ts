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
};
