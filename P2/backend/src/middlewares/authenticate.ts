import { Request, Response, NextFunction } from "express";
import { JwtService } from "../services/JwtService";
import { COOKIE_NAME } from "../controllers/AuthController";

const jwtService = new JwtService();

/**
 * Middleware que se ejecuta ANTES de cualquier ruta protegida.
 *
 * Flujo:
 * 1. Lee el JWT de la cookie HttpOnly.
 * 2. Si es valido -> deja pasar la peticion, guarda userId/role en req.
 * 3. Si esta vencido pero DENTRO del tiempo de gracia -> genera un
 *    nuevo token automaticamente, lo vuelve a mandar en la cookie, y
 *    deja pasar la peticion (renovacion transparente para el usuario).
 * 4. Si esta vencido y FUERA del tiempo de gracia, o el token es
 *    invalido -> responde 401 (el usuario debe hacer login de nuevo).
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
        return res.status(401).json({ error: "No autenticado." });
    }

    const result = jwtService.verify(token);

    switch (result.status) {
        case "valid": {
            (req as any).userId = result.payload.sub;
            (req as any).role = result.payload.role;
            return next();
        }

        case "expired_in_grace": {
            const newToken = jwtService.sign({
                sub: result.payload.sub,
                role: result.payload.role,
            });
            res.cookie(COOKIE_NAME, newToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
            });
            (req as any).userId = result.payload.sub;
            (req as any).role = result.payload.role;
            return next();
        }

        case "expired_out_of_grace":
            return res.status(401).json({ error: "Sesion expirada. Inicia sesion de nuevo." });

        case "invalid":
        default:
            return res.status(401).json({ error: "Token invalido." });
    }
}