import express from "express";
import cors from "cors";
import { env } from "./env";
import { isAllowed, ProtectedRoute, Role } from "./permissions";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

/**
 * Endpoint principal del microservicio de autorizacion.
 * Recibe { role, route } y responde si el acceso esta permitido.
 *
 * Para poder probar el retry loop del backend principal, este
 * endpoint simula fallas temporales aleatorias segun
 * SIMULATE_FAILURE_RATE (0 = nunca falla, 1 = siempre falla).
 */
app.post("/authorize", (req, res) => {
    const { role, route } = req.body as { role?: Role; route?: ProtectedRoute };

    if (!role || !route) {
        return res.status(400).json({ error: "role y route son requeridos." });
    }

    // Simulacion de falla temporal (para probar el retry loop).
    if (Math.random() < env.simulateFailureRate) {
        return res.status(503).json({ error: "Servicio de autorizacion no disponible temporalmente." });
    }

    const allowed = isAllowed(role, route);
    return res.status(200).json({ allowed });
});

export default app;