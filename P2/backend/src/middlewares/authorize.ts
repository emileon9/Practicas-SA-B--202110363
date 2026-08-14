import { Request, Response, NextFunction } from "express";
import { AuthorizationClient, ProtectedRoute } from "../services/AuthorizationClient";

const authorizationClient = new AuthorizationClient();

/**
 * Middleware factory: crea un middleware que protege una ruta
 * especifica (ROUTE_1 o ROUTE_2), consultando el microservicio de
 * autorizacion independiente.
 *
 * Debe usarse DESPUES de "authenticate", porque depende de
 * req.role, que ese middleware ya valido y coloco en el request.
 */
export function authorize(route: ProtectedRoute) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const role = (req as any).role;
        if (!role) {
            return res.status(401).json({ error: "No autenticado." });
        }

        const allowed = await authorizationClient.authorize(role, route);

        if (!allowed) {
            return res.status(403).json({ error: "Acceso denegado para tu rol." });
        }

        return next();
    };
}