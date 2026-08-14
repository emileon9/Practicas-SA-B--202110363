import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import protectedRoutes from "./routes/protected.routes";

const app = express();

app.use(
    cors({
        origin: env.frontendOrigin,
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRoutes);
app.use("/protected", protectedRoutes);

export default app;