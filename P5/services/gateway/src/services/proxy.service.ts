import { createProxyMiddleware } from "http-proxy-middleware";

/**
 * Crea un proxy HTTP hacia un microservicio interno.
 * Unico lugar donde el Gateway sabe "hacia donde" reenviar (SRP).
 *
 * No se hace pathRewrite: Express ya deja req.url relativo al montar
 * cada ruta con router.use("/users", ...), asi que /api/users/health
 * llega al proxy como "/health", que es justo lo que expone cada MS.
 */
export function createServiceProxy(target: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
  });
}
