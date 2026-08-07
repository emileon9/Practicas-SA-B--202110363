import { PrismaClient } from "@prisma/client";
import { IUserRepository } from "./IUserRepository";
import { PersistedUser, Role } from "../domain/types";

const prisma = new PrismaClient();

/**
 * Implementacion concreta de IUserRepository usando Prisma + PostgreSQL.
 * Es la UNICA clase del proyecto que sabe que existe Prisma.
 */
export class PrismaUserRepository implements IUserRepository {
    async findByEmailHash(emailHash: string): Promise<PersistedUser | null> {
        const user = await prisma.user.findUnique({ where: { emailHash } });
        return user as PersistedUser | null;
    }

    async findById(id: string): Promise<PersistedUser | null> {
        const user = await prisma.user.findUnique({ where: { id } });
        return user as PersistedUser | null;
    }

    async create(data: {
        nameEncrypted: string;
        emailEncrypted: string;
        emailHash: string;
        passwordHash: string;
        role: Role;
    }): Promise<PersistedUser> {
        const user = await prisma.user.create({ data });
        return user as PersistedUser;
    }
}