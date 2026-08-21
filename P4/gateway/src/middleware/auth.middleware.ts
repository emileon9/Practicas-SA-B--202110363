import { Request, Response, NextFunction } from "express";

/**
 * Middleware de autenticacion PREPARADO para integrar el servicio real
 * de la Practica 2 (P2/backend, JWT en cookie HttpOnly).
 *
 * TODO(P2-integration): reemplazar este stub por la validacion real,
 * por ejemplo llamando a env.authServiceUrl o verificando el JWT con
 * la misma logica de P2/backend/src/services/JwtService.ts.
 *
 * Por ahora no bloquea peticiones: solo deja el punto de extension listo.
 */
export function authMiddleware(_req: Request, _res: Response, next: NextFunction) {
  next();
}
