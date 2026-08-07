import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { AuthService } from "../services/AuthService";
import { PrismaUserRepository } from "../repositories/PrismaUserRepository";
import { CryptoService } from "../services/CryptoService";
import { PasswordService } from "../services/PasswordService";
import { JwtService } from "../services/JwtService";
import { authenticate } from "../middlewares/authenticate";

// "Composition root": aqui es donde se conectan las implementaciones
// concretas con las abstracciones. Es el UNICO lugar que sabe que
// usamos Prisma como repositorio; si se cambia, solo se toca esta linea.
const authService = new AuthService(
    new PrismaUserRepository(),
    new CryptoService(),
    new PasswordService(),
    new JwtService()
);
const authController = new AuthController(authService);

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);

export default router;