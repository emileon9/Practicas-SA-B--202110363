import { createProxyMiddleware } from "http-proxy-middleware";

/**
 * Crea un proxy HTTP hacia un microservicio interno.
 * Unico lugar donde el Gateway sabe "hacia donde" reenviar (SRP).
 */
export function createServiceProxy(target: string, pathRewrite: Record<string, string>) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
  });
}
