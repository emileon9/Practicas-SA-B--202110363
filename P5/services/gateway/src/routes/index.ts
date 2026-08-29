import { Router } from "express";
import { usersRoutes } from "./users.routes";
import { productsRoutes } from "./products.routes";
import { ordersRoutes } from "./orders.routes";
import { notificationsRoutes } from "./notifications.routes";

export const router = Router();

router.use("/users", usersRoutes);
router.use("/products", productsRoutes);
router.use("/orders", ordersRoutes);
router.use("/notifications", notificationsRoutes);
