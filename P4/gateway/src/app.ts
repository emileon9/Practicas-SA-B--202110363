import express from "express";
import cors from "cors";
import { router } from "./routes";
import { authMiddleware } from "./middleware/auth.middleware";

const app = express();

app.use(cors());
app.use(express.json());
app.use(authMiddleware);

app.get("/health", (_req, res) => res.json({ status: "ok", service: "gateway" }));

app.use("/api", router);

export default app;
