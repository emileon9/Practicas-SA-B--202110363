import { env } from "../config/env";
import { Role } from "../domain/types";

export type ProtectedRoute = "ROUTE_1" | "ROUTE_2";

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cliente HTTP hacia el microservicio de autorizacion, con reintentos
 * y backoff exponencial ante fallas temporales (timeouts, 5xx, errores
 * de red). Numero maximo de intentos y backoff base configurables por
 * variable de entorno.
 *
 * Responsabilidad unica: hablar con el microservicio de autorizacion
 * de forma resiliente. La logica de "que hacer si no responde" (el
 * retry loop) vive aqui, no en el middleware que lo usa.
 */
export class AuthorizationClient {
    constructor(
        private readonly baseUrl: string = env.authzServiceUrl,
        private readonly maxRetries: number = env.authzMaxRetries,
        private readonly backoffBaseMs: number = env.authzBackoffBaseMs
    ) { }

    async authorize(role: Role, route: ProtectedRoute): Promise<boolean> {
        let lastError: unknown = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000); // 3s por intento

                const response = await fetch(`${this.baseUrl}/authorize`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role, route }),
                    signal: controller.signal,
                });

                clearTimeout(timeout);

                if (response.ok) {
                    const data = (await response.json()) as { allowed: boolean };
                    return data.allowed;
                }

                // Respuesta de error del servidor (ej. 503) -> falla temporal, reintentar
                lastError = new Error(`Microservicio respondio con status ${response.status}`);
            } catch (err) {
                // Error de red, timeout, etc. -> falla temporal, reintentar
                lastError = err;
            }

            const isLastAttempt = attempt === this.maxRetries;
            if (!isLastAttempt) {
                const backoffMs = this.backoffBaseMs * Math.pow(2, attempt - 1); // 1x, 2x, 4x...
                console.warn(
                    `[AuthorizationClient] Intento ${attempt}/${this.maxRetries} fallo. Reintentando en ${backoffMs}ms...`
                );
                await sleep(backoffMs);
            }
        }

        console.error(
            `[AuthorizationClient] Se agotaron los ${this.maxRetries} intentos. Denegando acceso por error de comunicacion.`,
            lastError
        );

        return false;
    }
}