export type Role = "ADMIN" | "CLIENT";

/**
 * Representa un usuario ya "desencriptado" a nivel de aplicacion,
 * listo para usarse en la logica de negocio.
 */
export interface AppUser {
    id: string;
    name: string;
    email: string;
    role: Role;
}

/**
 * Datos crudos tal como se guardan en la base de datos
 * (campos sensibles encriptados / hasheados).
 */
export interface PersistedUser {
    id: string;
    emailEncrypted: string;
    emailHash: string;
    nameEncrypted: string;
    passwordHash: string;
    role: Role;
}

export interface RegisterInput {
    name: string;
    email: string;
    password: string;
    role?: Role;
}

export interface LoginInput {
    email: string;
    password: string;
}

/**
 * Payload que viaja dentro del JWT.
 * Nunca metemos datos sensibles en texto plano aqui, solo lo minimo
 * necesario para autenticar/autorizar.
 */
export interface JwtPayload {
    sub: string; // id de usuario
    role: Role;
}