import { IUserRepository } from "../repositories/IUserRepository";
import { CryptoService } from "./CryptoService";
import { PasswordService } from "./PasswordService";
import { JwtService } from "./JwtService";
import { AppUser, LoginInput, RegisterInput } from "../domain/types";

/**
 * Orquesta el flujo de registro y login.
 *
 * Nota de diseno: AuthService recibe sus dependencias (repositorio,
 * crypto, password, jwt) por CONSTRUCTOR en vez de crearlas el mismo.
 * Esto es "inyeccion de dependencias" y hace que la clase sea facil de
 * probar (se le puede pasar un repositorio falso/mock en tests) y facil
 * de extender sin modificar su codigo interno (Open/Closed Principle).
 */
export class AuthService {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly crypto: CryptoService,
        private readonly passwords: PasswordService,
        private readonly jwt: JwtService
    ) { }

    async register(input: RegisterInput): Promise<AppUser> {
        const emailHash = this.crypto.deterministicHash(input.email);

        const existing = await this.userRepository.findByEmailHash(emailHash);
        if (existing) {
            throw new Error("Ya existe un usuario registrado con ese correo.");
        }

        const nameEncrypted = this.crypto.encrypt(input.name);
        const emailEncrypted = this.crypto.encrypt(input.email);
        const passwordHash = await this.passwords.hash(input.password);

        const created = await this.userRepository.create({
            nameEncrypted,
            emailEncrypted,
            emailHash,
            passwordHash,
            role: input.role ?? "CLIENT",
        });

        return {
            id: created.id,
            name: input.name,
            email: input.email,
            role: created.role,
        };
    }

    /**
     * Retorna el usuario autenticado + el JWT firmado, listo para
     * mandarse en una cookie HttpOnly desde el controlador.
     */
    async login(input: LoginInput): Promise<{ user: AppUser; token: string }> {
        const emailHash = this.crypto.deterministicHash(input.email);
        const persisted = await this.userRepository.findByEmailHash(emailHash);

        if (!persisted) {
            throw new Error("Credenciales invalidas.");
        }

        const passwordMatches = await this.passwords.compare(input.password, persisted.passwordHash);
        if (!passwordMatches) {
            throw new Error("Credenciales invalidas.");
        }

        const token = this.jwt.sign({ sub: persisted.id, role: persisted.role });

        const user: AppUser = {
            id: persisted.id,
            name: this.crypto.decrypt(persisted.nameEncrypted),
            email: this.crypto.decrypt(persisted.emailEncrypted),
            role: persisted.role,
        };

        return { user, token };
    }

    async getById(id: string): Promise<AppUser | null> {
        const persisted = await this.userRepository.findById(id);
        if (!persisted) return null;
        return {
            id: persisted.id,
            name: this.crypto.decrypt(persisted.nameEncrypted),
            email: this.crypto.decrypt(persisted.emailEncrypted),
            role: persisted.role,
        };
    }
}