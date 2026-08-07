import { Request, Response } from "express";
import { AuthService } from "../services/AuthService";

const COOKIE_NAME = "token";

/**
 * Responsabilidad unica: adaptar HTTP (req/res) hacia AuthService.
 * No contiene logica de negocio, solo orquesta la llamada y el manejo
 * de la cookie/respuesta HTTP.
 */
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    private setAuthCookie(res: Response, token: string) {
        res.cookie(COOKIE_NAME, token, {
            httpOnly: true, // JS del navegador NO puede leer esta cookie (mitiga XSS)
            secure: process.env.NODE_ENV === "production", // solo HTTPS en produccion
            sameSite: "lax",
            path: "/",
        });
    }

    register = async (req: Request, res: Response) => {
        try {
            const { name, email, password } = req.body;
            if (!name || !email || !password) {
                return res.status(400).json({ error: "name, email y password son requeridos." });
            }
            const user = await this.authService.register({ name, email, password });
            return res.status(201).json({ user });
        } catch (err: any) {
            return res.status(400).json({ error: err.message ?? "Error al registrar usuario." });
        }
    };

    login = async (req: Request, res: Response) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: "email y password son requeridos." });
            }
            const { user, token } = await this.authService.login({ email, password });
            this.setAuthCookie(res, token);
            return res.status(200).json({ user });
        } catch (err: any) {
            return res.status(401).json({ error: err.message ?? "Credenciales invalidas." });
        }
    };

    logout = async (_req: Request, res: Response) => {
        res.clearCookie(COOKIE_NAME, { path: "/" });
        return res.status(200).json({ message: "Sesion cerrada." });
    };

    /**
     * Endpoint de "confirmacion": el frontend lo llama tras el login
     * exitoso para mostrar la pagina de bienvenida con datos del usuario.
     */
    me = async (req: Request, res: Response) => {
        const userId = (req as any).userId as string;
        const user = await this.authService.getById(userId);
        if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
        return res.status(200).json({ user });
    };
}

export { COOKIE_NAME };