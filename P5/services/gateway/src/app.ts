import express from "express";
import cors from "cors";
import { router } from "./routes";
import { authMiddleware } from "./middleware/auth.middleware";

const app = express();

app.use(cors());
app.use(authMiddleware);

// El proxy hacia los microservicios va ANTES de express.json(): asi el
// body de las peticiones (por ejemplo POST /api/users/graphql) llega
// intacto al microservicio en vez de ser consumido por este Gateway.
app.use("/api", router);

app.use(express.json());
app.get("/health", (_req, res) => res.json({ status: "ok", service: "gateway" }));

export default app;
