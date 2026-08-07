import { PersistedUser, Role } from "../domain/types";

/**
 * Contrato que cualquier repositorio de usuarios debe cumplir.
 *
 * Gracias a esta interfaz, AuthService (capa de negocio) depende de
 * una ABSTRACCION y no de Prisma directamente. Si mañana cambiamos
 * Prisma por TypeORM, o de Postgres a MySQL, solo se crea otra clase
 * que implemente esta interfaz; AuthService no cambia
 * (Dependency Inversion Principle).
 */
export interface IUserRepository {
    findByEmailHash(emailHash: string): Promise<PersistedUser | null>;
    findById(id: string): Promise<PersistedUser | null>;
    create(data: {
        nameEncrypted: string;
        emailEncrypted: string;
        emailHash: string;
        passwordHash: string;
        role: Role;
    }): Promise<PersistedUser>;
}