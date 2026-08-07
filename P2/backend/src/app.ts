import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";

const app = express();

app.use(
    cors({
        origin: env.frontendOrigin,
        credentials: true, // necesario para que el navegador mande/reciba cookies
    })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRoutes);
// Las rutas protegidas (Ruta 1 / Ruta 2 del enunciado) se agregaran
// mas adelante, cuando conectemos el microservicio de autorizacion.

export default app;