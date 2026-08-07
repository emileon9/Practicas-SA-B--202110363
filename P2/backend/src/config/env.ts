import "dotenv/config";

declare const process: {
    env: Record<string, string | undefined>;
};

/**
 * Centraliza el acceso a las variables de entorno.
 * Si en el futuro cambiamos de .env a otro proveedor de configuracion
 * (ej. AWS Secrets Manager), solo se modifica este archivo
 * (Principio Abierto/Cerrado - el resto del codigo no depende de "dotenv").
 */
function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Falta la variable de entorno requerida: ${name}`);
    }
    return value;
}

export const env = {
    port: parseInt(process.env.PORT ?? "4000", 10),
    frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",

    databaseUrl: required("DATABASE_URL"),

    jwtSecret: required("JWT_SECRET"),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
    jwtRefreshGrace: process.env.JWT_REFRESH_GRACE ?? "5m",

    aesSecretKey: required("AES_SECRET_KEY"),
    emailHashSecret: required("EMAIL_HASH_SECRET"),

    authzServiceUrl: process.env.AUTHZ_SERVICE_URL ?? "http://localhost:5000",
    authzMaxRetries: parseInt(process.env.AUTHZ_MAX_RETRIES ?? "3", 10),
    authzBackoffBaseMs: parseInt(process.env.AUTHZ_BACKOFF_BASE_MS ?? "500", 10),
};