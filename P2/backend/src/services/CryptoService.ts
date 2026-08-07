import * as crypto from "crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16; // bytes, requerido por AES-CBC

/**
 * Encapsula toda la logica de encriptacion/desencriptacion AES.
 * Responsabilidad unica: cifrar y descifrar texto (Single Responsibility).
 *
 * Nota importante: AES-CBC necesita un IV (vector de inicializacion)
 * distinto en cada operacion para que el mismo texto plano nunca
 * produzca el mismo texto cifrado. Por eso guardamos el IV junto con
 * el texto cifrado, separados por ":". El IV no es secreto, solo debe
 * ser aleatorio.
 */
export class CryptoService {
    private readonly key: Buffer;

    constructor(secretKey: string = env.aesSecretKey) {
        if (Buffer.byteLength(secretKey) !== 32) {
            throw new Error("AES_SECRET_KEY debe tener exactamente 32 caracteres (AES-256).");
        }
        this.key = Buffer.from(secretKey, "utf8");
    }

    encrypt(plainText: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
        const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
        return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
    }