import jwt, { TokenExpiredError } from "jsonwebtoken";
import { env } from "../config/env";
import { JwtPayload } from "../domain/types";

/**
 * Convierte strings tipo "15m", "5m", "1h" a milisegundos.
 * jsonwebtoken ya acepta este formato para "expiresIn", pero nosotros
 * tambien necesitamos el valor en ms para calcular el tiempo de gracia
 * manualmente, asi que lo parseamos nosotros mismos.
 */
function parseDurationToMs(duration: string): number {
    const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration.trim());
    if (!match) {
        throw new Error(`Formato de duracion invalido: ${duration}`);
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
        ms: 1,
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };
    return value * multipliers[unit];
}

export type VerifyResult =
    | { status: "valid"; payload: JwtPayload }
    | { status: "expired_in_grace"; payload: JwtPayload }
    | { status: "expired_out_of_grace" }
    | { status: "invalid" };

/**
 * Responsabilidad unica: todo lo relacionado a crear y validar JWT,
 * incluyendo la logica de "tiempo de gracia" para renovacion automatica.
 */
export class JwtService {
    sign(payload: JwtPayload): string {
        return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as any });
    }

    /**
     * Verifica un token y clasifica el resultado en 4 posibles estados,
     * para que el middleware decida que hacer en cada caso:
     *  - valid: token vigente, seguir normalmente.
     *  - expired_in_grace: vencido pero aun se puede renovar automaticamente.
     *  - expired_out_of_grace: vencido y fuera del tiempo de gracia -> login de nuevo.
     *  - invalid: token malformado o firma invalida -> rechazar.
     */
    verify(token: string): VerifyResult {
        try {
            const payload = jwt.verify(token, env.jwtSecret) as JwtPayload & { exp: number };
            return { status: "valid", payload };
        } catch (err) {
            if (err instanceof TokenExpiredError) {
                // Decodificamos sin validar expiracion para leer el payload y el "exp"
                const decoded = jwt.decode(token) as (JwtPayload & { exp: number }) | null;
                if (!decoded) return { status: "invalid" };

                const graceMs = parseDurationToMs(env.jwtRefreshGrace);
                const expiredAtMs = decoded.exp * 1000;
                const elapsedSinceExpiry = Date.now() - expiredAtMs;

                if (elapsedSinceExpiry <= graceMs) {
                    return { status: "expired_in_grace", payload: decoded };
                }
                return { status: "expired_out_of_grace" };
            }
            return { status: "invalid" };
        }
    }
}