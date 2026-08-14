import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";

const router = Router();

// Ruta 1: solo Admin
router.get("/route1", authenticate, authorize("ROUTE_1"), (_req, res) => {
    res.json({ message: "Bienvenido a la Ruta 1 (solo Admin)." });
});

// Ruta 2: Admin y Cliente
router.get("/route2", authenticate, authorize("ROUTE_2"), (_req, res) => {
    res.json({ message: "Bienvenido a la Ruta 2 (Admin y Cliente)." });
});

export default router;