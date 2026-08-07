import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

/**
 * Responsabilidad unica: manejar el hashing y verificacion de contrasenas.
 *
 * IMPORTANTE: la contrasena se HASHEA (bcrypt), no se ENCRIPTA (AES).
 * La diferencia es clave para el README:
 *  - Encriptar (AES) es reversible: si tienes la llave, recuperas el
 *    texto original. Se usa para datos que la app necesita volver a leer
 *    (nombre, correo).
 *  - Hashear (bcrypt) es de un solo sentido: nunca se recupera el texto
 *    original, solo se compara un intento contra el hash guardado.
 *    Es lo correcto para contrasenas, porque ni siquiera nosotros
 *    deberiamos poder ver la contrasena real de un usuario.
 */
export class PasswordService {
    async hash(plainPassword: string): Promise<string> {
        return bcrypt.hash(plainPassword, SALT_ROUNDS);
    }

    async compare(plainPassword: string, hash: string): Promise<boolean> {
        return bcrypt.compare(plainPassword, hash);
    }
}